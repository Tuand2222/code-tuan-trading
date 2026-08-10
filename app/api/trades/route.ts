import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { tradeImages, trades } from "../../../db/schema";
import { requireUser, routeError, type AuthenticatedUser } from "../../../lib/server-auth";

type TradePayload = typeof trades.$inferInsert;

async function deleteTradeImages(userId: string, tradeId?: string) {
  const db = getDb();
  const condition = tradeId
    ? and(eq(tradeImages.userId, userId), eq(tradeImages.tradeId, tradeId))
    : eq(tradeImages.userId, userId);
  const images = await db
    .select({ objectKey: tradeImages.objectKey })
    .from(tradeImages)
    .where(condition);
  for (let index = 0; index < images.length; index += 1000) {
    await env.BUCKET.delete(images.slice(index, index + 1000).map((image) => image.objectKey));
  }
  if (images.length) await db.delete(tradeImages).where(condition);
}

function cleanTrade(value: Partial<TradePayload>, accountUser: AuthenticatedUser): TradePayload {
  const market = String(value.market ?? "Hàng hóa");
  const source = String(value.source ?? "Thủ công");
  const symbol = String(value.symbol ?? "").trim().toUpperCase();
  const date = String(value.date ?? "");
  if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Symbol and a valid date are required");
  }
  return {
    id: String(value.id ?? crypto.randomUUID()),
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
    quantity: Number(value.quantity) || 0,
    entryPrice: Number(value.entryPrice) || 0,
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
      .where(eq(trades.userId, accountUser.id))
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
    if (!input.length || input.length > 2000) throw new Error("Trade data is required");
    const values = input.map((trade) => cleanTrade(trade, accountUser));
    const inserted = await getDb()
      .insert(trades)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return Response.json({ trades: inserted, imported: inserted.length }, { status: 201 });
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
    const value = cleanTrade(body.trade ?? {}, accountUser);
    const [updated] = await getDb()
      .update(trades)
      .set({
        externalId: value.externalId,
        market: value.market,
        source: value.source,
        accountId: value.accountId,
        date: value.date,
        symbol: value.symbol,
        side: value.side,
        session: value.session,
        setup: value.setup,
        timeframe: value.timeframe,
        risk: value.risk,
        pnl: value.pnl,
        fees: value.fees,
        quantity: value.quantity,
        entryPrice: value.entryPrice,
        exitPrice: value.exitPrice,
        discipline: value.discipline,
        psychology: value.psychology,
        note: value.note,
        durationMin: value.durationMin,
      })
      .where(and(eq(trades.id, id), eq(trades.userId, accountUser.id)))
      .returning();
    if (!updated) return new Response("Trade not found", { status: 404 });
    return Response.json({ trade: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get("id");
    if (searchParams.get("all") === "1") {
      await deleteTradeImages(accountUser.id);
      await getDb().delete(trades).where(eq(trades.userId, accountUser.id));
    } else {
      if (!id) throw new Error("Trade id is required");
      await deleteTradeImages(accountUser.id, id);
      await getDb()
        .delete(trades)
        .where(and(eq(trades.id, id), eq(trades.userId, accountUser.id)));
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
