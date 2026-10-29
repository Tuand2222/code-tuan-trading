import {QuantV34} from './quant-v34.js';
import {JournalAdapters} from './journal-adapters.js';
import {JournalForm} from './trade-form.js';
export const PositionProjection={
 closedCycles(receipts) {
  const groups = new Map();
  for (const t of receipts.filter((t) => t.recordKind === "fill")) {
    let positionSide = "";
    try {
      positionSide = JournalForm.metadata(t).positionSide || JSON.parse(t.rawPayloadJson ?? "{}").positionSide || "";
    } catch {
      /* source remains available for review */
    }
    const key = JSON.stringify([t.accountId, t.source, t.symbol, positionSide]);
    const items=groups.get(key);if(items)items.push(t);else groups.set(key,[t]);
  }
  const closed=[];
  const open=[];
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
    let qty = QuantV34.decimal(0),
      entryValue = QuantV34.decimal(0),
      exitValue = QuantV34.decimal(0),
      openedQty = QuantV34.decimal(0),
      closedQty = QuantV34.decimal(0),
      gross = QuantV34.decimal(0),
      fees = QuantV34.decimal(0),swap = QuantV34.decimal(0);
    let first;
    let ids=[];
    let complete = true;
    let costsKnown = true,profitKnown=true,batchIncomplete=false;
    let direction = 1;
    for (const fill of fills) {
      const amount = QuantV34.decimal(fill.quantity ?? 0);
      if (!amount || !amount.isFinite() || amount.lte(0) || !(fill.entryPrice > 0) || ![fill.pnl,fill.fees??0,fill.swap??0].every(Number.isFinite)) {
        complete = false;
        continue;
      }
      costsKnown = costsKnown && fill.feesKnown !== false;
      profitKnown=profitKnown&&fill.pnlKnown!==false;
      batchIncomplete=batchIncomplete||JournalForm.metadata(fill).batchIncomplete===true;
      let delta = amount.mul(fill.side === "Buy" ? 1 : -1);
      const price = QuantV34.decimal(fill.entryPrice);
      if (qty.isZero()) {
        first = fill;
        direction = delta.isPositive() ? 1 : -1;
        entryValue = QuantV34.decimal(0);
        exitValue = QuantV34.decimal(0);
        openedQty = QuantV34.decimal(0);
        closedQty = QuantV34.decimal(0);
        gross = QuantV34.decimal(0);
        fees = QuantV34.decimal(0);
        swap = QuantV34.decimal(0);
        ids = [];
        // A first receipt with realized P&L means our history starts mid-position.
        complete = fill.pnl === 0;
        costsKnown = fill.feesKnown !== false;
        profitKnown=fill.pnlKnown!==false;
        batchIncomplete=JournalForm.metadata(fill).batchIncomplete===true;
      }
      if (qty.isZero() || qty.isPositive() === delta.isPositive()) {
        entryValue = entryValue.add(amount.mul(price));
        openedQty = openedQty.add(amount);
        qty = qty.add(delta);
        gross = gross.add(fill.pnl);
        fees = fees.add(fill.fees ?? 0);
        swap=swap.add(fill.swap??0);
        ids.push(fill.id);
        continue;
      }
      const closing = (qty.abs().lt(amount)?qty.abs():amount);
      exitValue = exitValue.add(closing.mul(price));
      closedQty = closedQty.add(closing);
      gross = gross.add(fill.pnl);
      fees = fees.add(QuantV34.decimal(fill.fees ?? 0).mul(closing).div(amount));
      swap=swap.add(QuantV34.decimal(fill.swap??0).mul(closing).div(amount));
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
          fees: fees.toNumber(),swap:swap.toNumber(),pnlKnown:profitKnown,
          unifiedV6:{sourceFillIds:[...ids],is_net_pnl_verified:costsKnown&&profitKnown,is_1r_verified:false,netPnlSource:"execution_cycle",batchIncomplete},
          normalized:undefined,
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
        exitValue = QuantV34.decimal(0);
        closedQty = QuantV34.decimal(0);
        gross = QuantV34.decimal(0);
        fees = QuantV34.decimal(fill.fees ?? 0).mul(residual).div(amount);
        swap = QuantV34.decimal(fill.swap ?? 0).mul(residual).div(amount);
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
 },
 analytics(trades){
  const raw=trades.filter(t=>t._classic?.recordKind==="fill").map(t=>({...JournalAdapters.toClassic(t),pnlKnown:t._classic.pnlKnown,feesKnown:t._classic.feesKnown}));
  const projected=PositionProjection.closedCycles(raw),matched=new Set(projected.closed.flatMap(t=>t.unifiedV6.sourceFillIds));
  return [...trades.filter(t=>t._classic?.recordKind!=="fill"||!matched.has(t.id)),...projected.closed.map(t=>JournalAdapters.fromClassic(t))];
 }
};
export const positionCycles=PositionProjection.closedCycles;
