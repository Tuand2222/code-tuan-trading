import { normalizeBroker } from "./unified-ingestion";
import Decimal from "decimal.js";
import type { ReportTrade } from "./governance-report";
/** A projection only. Original execution receipts remain immutable in the ledger. */
export function positionCycles<T extends ReportTrade>(receipts: T[]) {
  const groups = new Map<string, T[]>();
  for (const t of receipts.filter((t) => t.recordKind === "fill")) {
    let positionSide = "";
    try {
      positionSide = JSON.parse(t.rawPayloadJson ?? "{}").positionSide ?? "";
    } catch {
      /* source remains available for review */
    }
    const key = JSON.stringify([t.accountId, t.source, t.symbol, positionSide]);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const closed: ReportTrade[] = [];
  const open: Array<{
    symbol: string;
    quantity: string;
    accountId?: string | null;
    complete: boolean;
  }> = [];
  for (const fills of groups.values()) {
    fills.sort(
      (a, b) =>
        (a.closedAt ?? a.date).localeCompare(b.closedAt ?? b.date) ||
        (() => {
          const left = (a.externalId ?? "").split(":").at(-1) ?? "",
            right = (b.externalId ?? "").split(":").at(-1) ?? "";
          return /^\d+$/.test(left) && /^\d+$/.test(right)
            ? BigInt(left) < BigInt(right)
              ? -1
              : BigInt(left) > BigInt(right)
                ? 1
                : 0
            : 0;
        })(),
    );
    let qty = new Decimal(0),
      entryValue = new Decimal(0),
      exitValue = new Decimal(0),
      openedQty = new Decimal(0),
      closedQty = new Decimal(0),
      gross = new Decimal(0),
      fees = new Decimal(0);
    let first: T | undefined;
    let ids: string[] = [];
    let complete = true;
    let costsKnown = true;
    let direction = 1;
    for (const fill of fills) {
      const amount = new Decimal(fill.quantity ?? 0);
      if (!amount.isFinite() || amount.lte(0) || !(fill.entryPrice! > 0)) {
        complete = false;
        continue;
      }
      costsKnown = costsKnown && fill.feesKnown !== false;
      let delta = amount.mul(fill.side === "Buy" ? 1 : -1);
      const price = new Decimal(fill.entryPrice!);
      if (qty.isZero()) {
        first = fill;
        direction = delta.isPositive() ? 1 : -1;
        entryValue = new Decimal(0);
        exitValue = new Decimal(0);
        openedQty = new Decimal(0);
        closedQty = new Decimal(0);
        gross = new Decimal(0);
        fees = new Decimal(0);
        ids = [];
        // A first receipt with realized P&L means our history starts mid-position.
        complete = fill.pnl === 0;
        costsKnown = fill.feesKnown !== false;
      }
      if (qty.isZero() || qty.isPositive() === delta.isPositive()) {
        entryValue = entryValue.add(amount.mul(price));
        openedQty = openedQty.add(amount);
        qty = qty.add(delta);
        gross = gross.add(fill.pnl);
        fees = fees.add(fill.fees ?? 0);
        ids.push(fill.id);
        continue;
      }
      const closing = Decimal.min(qty.abs(), amount);
      exitValue = exitValue.add(closing.mul(price));
      closedQty = closedQty.add(closing);
      gross = gross.add(fill.pnl);
      fees = fees.add(new Decimal(fill.fees ?? 0).mul(closing).div(amount));
      ids.push(fill.id);
      const next = qty.add(delta);
      const finishes = next.isZero() || next.isPositive() !== qty.isPositive();
      if (finishes && complete && first && openedQty.eq(closedQty))
        closed.push({
          ...first,
          id: "cycle:" + first.id + ":" + fill.id,
          recordKind: "position",
          externalId: null,
          date: fill.date,
          openedAt: first.closedAt ?? first.date,
          closedAt: fill.closedAt ?? fill.date,
          side: direction > 0 ? "Buy" : "Sell",
          quantity: openedQty.toNumber(),
          entryPrice: entryValue.div(openedQty).toNumber(),
          exitPrice: exitValue.div(closedQty).toNumber(),
          pnl: gross.toNumber(),
          fees: fees.toNumber(),
          risk: 0,
          riskKnown: false,
          feesKnown: costsKnown,
          source: first.source,
          setup: "Chưa phân loại",
          discipline: 0,
          durationMin: Math.max(
            0,
            (Date.parse(fill.closedAt ?? fill.date) -
              Date.parse(first.closedAt ?? first.date)) /
              60000,
          ),
          note:
            "Chu kỳ dựng từ " +
            ids.length +
            " execution; giữ nguyên phiếu gốc.",
          rawPayloadJson: JSON.stringify({ fillIds: ids, complete: true }),
        });
      if (finishes && !next.isZero()) {
        const residual = next.abs();
        first = fill;
        direction = next.isPositive() ? 1 : -1;
        entryValue = residual.mul(price);
        openedQty = residual;
        exitValue = new Decimal(0);
        closedQty = new Decimal(0);
        gross = new Decimal(0);
        fees = new Decimal(fill.fees ?? 0).mul(residual).div(amount);
        ids = [fill.id];
        complete = true;
      }
      qty = next;
    }
    if (!qty.isZero())
      open.push({
        symbol: fills[0].symbol,
        accountId: fills[0].accountId,
        quantity: qty.toString(),
        complete,
      });
  }
  return { closed, open };
}
