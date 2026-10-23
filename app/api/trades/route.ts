import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { tradeAudit, trades } from "../../../db/schema";
import {
  requireUser,
  routeError,
  type AuthenticatedUser,
} from "../../../lib/server-auth";

import { ingestTrades } from "../../../lib/server-ingestion";

type TradePayload = typeof trades.$inferInsert;

function cleanTrade(
  value: Partial<TradePayload>,
  accountUser: AuthenticatedUser,
): TradePayload {
  const market = String(value.market ?? "Hàng hóa");
  const source = String(value.source ?? "Thủ công");
  const symbol = String(value.symbol ?? "")
    .trim()
    .toUpperCase();
  const date = String(value.date ?? "");
  if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Symbol and a valid date are required");
  }
  return {
    id: String(value.id ?? crypto.randomUUID()),
    openedAt: value.openedAt,
    closedAt: value.closedAt,
    mae: value.mae,
    mfe: value.mfe,
    rulesJson: value.rulesJson,
    feesKnown: value.feesKnown ?? true,
    pnlKnown: value.pnlKnown ?? true,
    recordKind: value.recordKind ?? "position",
    riskKnown: value.riskKnown ?? true,
    rawPayloadJson: JSON.stringify(value),
    userId: accountUser.id,
    userEmail: accountUser.email,
    externalId: value.externalId ? String(value.externalId) : null,
    market,
    source,
    accountId: value.accountId ? String(value.accountId) : null,
    date,
    symbol,
    side: value.side === "Sell" ? "Sell" : "Buy",
    session: String(value.session ?? "Châu Á"),
    setup: String(value.setup ?? "Nhập dữ liệu"),
    timeframe: String(value.timeframe ?? "—"),
    risk: Number(value.risk) || 0,
    pnl: Number(value.pnl) || 0,
    fees: Number(value.fees) || 0,
    swap: Number(value.swap) || 0,
    quantity: Number(value.quantity) || 0,
    entryPrice: Number(value.entryPrice) || 0,
    stopLoss: Number(value.stopLoss) || 0,
    takeProfit: Number(value.takeProfit) || 0,
    exitPrice: Number(value.exitPrice) || 0,
    discipline: Math.max(0, Math.min(100, Number(value.discipline) || 0)),
    psychology: String(value.psychology ?? "Đồng bộ"),
    note: String(value.note ?? ""),
    durationMin: Math.max(0, Number(value.durationMin) || 0),
  };
}

export async function GET(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const rows = await getDb()
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.userId, accountUser.id),
          new URL(request.url).searchParams.get("trash") === "1"
            ? sql`${trades.deletedAt} >= ${new Date(Date.now() - 30 * 86400000).toISOString()}`
            : isNull(trades.deletedAt),
        ),
      )
      .orderBy(desc(trades.date), desc(trades.createdAt))
      .limit(5000);
    return Response.json({ trades: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const body = (await request.json()) as {
      trade?: Partial<TradePayload>;
      trades?: Partial<TradePayload>[];
    };
    const input = body.trades ?? (body.trade ? [body.trade] : []);
    if (!input.length || input.length > 500)
      throw new Error("Trade data is required");
    const values = input.map((trade) => cleanTrade(trade, accountUser));
    const result = await ingestTrades(
      values,
      String((body as { sourceType?: string }).sourceType ?? "MANUAL"),
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const body = (await request.json()) as { trade?: Partial<TradePayload> };
    const id = String(body.trade?.id ?? "").trim();
    if (!id) throw new Error("Trade id is required");
    const expectedVersion = body.trade?.version;
    if (!Number.isInteger(expectedVersion))
      return Response.json(
        { error: "Version required; reload this record before editing." },
        { status: 409 },
      );
    const db = getDb();
    const [current] = await db
      .select()
      .from(trades)
      .where(and(eq(trades.id, id), eq(trades.userId, accountUser.id)))
      .limit(1);
    if (!current) return new Response("Trade not found", { status: 404 });
    const restore = (body as { restore?: boolean }).restore === true;
    if (
      restore &&
      (!current.deletedAt ||
        Date.now() - Date.parse(current.deletedAt) > 30 * 86400000)
    )
      return Response.json(
        { error: "Restore window expired" },
        { status: 409 },
      );
    const value = cleanTrade({ ...current, ...body.trade }, accountUser);
    const {
      id: _,
      userId: __,
      userEmail: ___,
      rawPayloadJson: ____,
      ...editable
    } = value;
    const result = await db.batch([
      db
        .update(trades)
        .set({
          ...editable,
          deletedAt: restore ? null : current.deletedAt,
          version: sql`${trades.version}+1`,
        })
        .where(
          and(
            eq(trades.id, id),
            eq(trades.userId, accountUser.id),
            eq(trades.version, expectedVersion!),
          ),
        )
        .returning(),
      db.insert(tradeAudit).values({
        id: crypto.randomUUID(),
        userId: accountUser.id,
        tradeId: id,
        batchId: crypto.randomUUID(),
        action: restore ? "RESTORE_ATTEMPT" : "EDIT_ATTEMPT",
        detailsJson: JSON.stringify({
          expectedVersion,
          before: current,
          after: editable,
        }),
      }),
    ]);
    if (!result[0][0])
      return Response.json(
        {
          error: "Record changed on another device. Reload and reconcile.",
          current,
        },
        { status: 409 },
      );
    return Response.json({ trade: result[0][0] });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get("id");
    if (!id && searchParams.get("all") !== "1")
      throw Error("Trade id is required");
    const condition = id
      ? and(
          eq(trades.userId, accountUser.id),
          eq(trades.id, id),
          isNull(trades.deletedAt),
        )
      : and(eq(trades.userId, accountUser.id), isNull(trades.deletedAt));
    await getDb().batch([
      getDb()
        .update(trades)
        .set({
          deletedAt: new Date().toISOString(),
          version: sql`${trades.version}+1`,
        })
        .where(condition),
      getDb()
        .insert(tradeAudit)
        .values({
          id: crypto.randomUUID(),
          userId: accountUser.id,
          tradeId: id,
          batchId: crypto.randomUUID(),
          action: "SOFT_DELETE",
          detailsJson: JSON.stringify({ id, all: !id }),
        }),
    ]);
    return Response.json({ deleted: true, recoverableDays: 30 });
  } catch (error) {
    return routeError(error);
  }
}
