import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { brokerConnections, trades } from "../../../../db/schema";
import { decryptBrokerSecrets } from "../../../../lib/broker-crypto";
import { routeError } from "../../../../lib/server-auth";

import { ingestTrades } from "../../../../lib/server-ingestion";

type IncomingTrade = Record<string, unknown>;
type TradeInsert = typeof trades.$inferInsert;

const MARKETS = new Map<string, string>([
  ["hanghoa", "Hàng hóa"],
  ["commodity", "Hàng hóa"],
  ["commodities", "Hàng hóa"],
  ["chungkhoan", "Chứng khoán"],
  ["cophieu", "Chứng khoán"],
  ["stock", "Chứng khoán"],
  ["stocks", "Chứng khoán"],
  ["security", "Chứng khoán"],
  ["securities", "Chứng khoán"],
  ["equity", "Chứng khoán"],
  ["equities", "Chứng khoán"],
  ["forex", "Forex"],
  ["fx", "Forex"],
  ["crypto", "Crypto"],
  ["coin", "Crypto"],
]);
const WEBHOOK_PROVIDERS = new Set([
  "webhook",
  "vps",
  "ssi",
  "tcx",
  "mt5",
  "cqg",
]);
const PROVIDER_DEFAULTS: Record<string, { market: string; source: string }> = {
  vps: { market: "Chứng khoán", source: "VPS" },
  ssi: { market: "Chứng khoán", source: "SSI FastConnect" },
  tcx: { market: "Chứng khoán", source: "TCX / TCBS" },
  mt5: { market: "Forex", source: "MetaTrader 5" },
  cqg: { market: "Hàng hóa", source: "CQG" },
};

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseTimestamp(raw: unknown, fallback = Date.now()) {
  if (typeof raw === "number") return raw < 10_000_000_000 ? raw * 1000 : raw;
  const parsed = Date.parse(String(raw ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTime(value: IncomingTrade) {
  return parseTimestamp(
    value.closedAt ?? value.closeTime ?? value.time ?? value.date,
  );
}

function sessionFor(timestamp: number) {
  const hour = new Date(timestamp).getUTCHours();
  if (hour < 8) return "Châu Á";
  if (hour < 14) return "London";
  return "New York";
}

function normalizeTrade(
  value: IncomingTrade,
  connection: typeof brokerConnections.$inferSelect,
  fxRate: number,
): TradeInsert {
  const externalId = String(
    value.externalId ??
      value.tradeId ??
      value.dealId ??
      value.executionId ??
      value.matchId ??
      value.orderId ??
      value.orderID ??
      value.ticket ??
      value.id ??
      "",
  ).trim();
  const symbol = String(value.symbol ?? value.ticker ?? value.instrument ?? "")
    .trim()
    .toUpperCase();
  if (!externalId || !symbol)
    throw new Error("Invalid trade: externalId and symbol are required");
  const providerDefault = PROVIDER_DEFAULTS[connection.provider];
  const suppliedMarket = value.market ?? value.assetClass;
  const market = suppliedMarket
    ? MARKETS.get(normalizeKey(suppliedMarket))
    : providerDefault?.market;
  if (!market) throw new Error("Invalid trade market");

  const timestamp = parseTime(value);
  const pnl =
    numberValue(value.pnl ?? value.profit ?? value.realizedPnl) * fxRate;
  const suppliedRisk = numberValue(value.risk ?? value.plannedRisk) * fxRate;
  const setup = String(value.setup ?? "").trim() || "Chưa phân loại";
  const source = providerDefault?.source ?? `Webhook · ${connection.label}`;
  const openedAt = parseTimestamp(value.openedAt ?? value.openTime, Number.NaN);
  const closedAt = parseTimestamp(
    value.closedAt ?? value.closeTime,
    Number.NaN,
  );
  const durationMin =
    Number.isFinite(openedAt) && Number.isFinite(closedAt)
      ? Math.max(0, Math.round((closedAt - openedAt) / 60000))
      : Math.max(0, numberValue(value.durationMin));
  const reviewNotes = [
    suppliedRisk > 0 ? "" : "Rủi ro dự kiến cần review",
    setup === "Chưa phân loại" ? "Setup cần phân loại" : "",
  ].filter(Boolean);

  return {
    id: crypto.randomUUID(),
    userId: connection.userId,
    userEmail: connection.userEmail,
    externalId,
    market,
    source,
    accountId: connection.id,
    date: new Date(timestamp).toISOString().slice(0, 10),
    symbol,
    side:
      normalizeKey(value.side ?? value.type).includes("sell") ||
      normalizeKey(value.side ?? value.type).includes("ban")
        ? "Sell"
        : "Buy",
    session: String(value.session ?? sessionFor(timestamp)),
    setup,
    timeframe: String(value.timeframe ?? "Auto"),
    risk: suppliedRisk,
    riskKnown: suppliedRisk > 0,
    rawPayloadJson: JSON.stringify(value),
    openedAt: Number.isFinite(openedAt)
      ? new Date(openedAt).toISOString()
      : null,
    closedAt: new Date(timestamp).toISOString(),
    pnl,
    fees: Math.abs(
      numberValue(value.fees ?? value.fee ?? value.commission) * fxRate,
    ),
    quantity: Math.abs(
      numberValue(value.quantity ?? value.qty ?? value.volume),
    ),
    entryPrice: numberValue(value.entryPrice ?? value.openPrice ?? value.price),
    exitPrice: numberValue(value.exitPrice ?? value.closePrice ?? value.price),
    discipline: Math.max(0, Math.min(100, numberValue(value.discipline))),
    psychology: String(value.psychology ?? "Chưa review"),
    note: [String(value.note ?? "").trim(), ...reviewNotes]
      .filter(Boolean)
      .join(" · "),
    durationMin,
  };
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    if (!token) return new Response("Unauthorized", { status: 401 });

    const tokenHash = await sha256Hex(token);
    const [connection] = await getDb()
      .select()
      .from(brokerConnections)
      .where(eq(brokerConnections.webhookTokenHash, tokenHash))
      .limit(1);
    if (
      !connection ||
      !WEBHOOK_PROVIDERS.has(connection.provider) ||
      (connection.provider !== "webhook" && connection.accountType !== "push")
    )
      return new Response("Unauthorized", { status: 401 });

    const body = (await request.json()) as
      | { trade?: IncomingTrade; trades?: IncomingTrade[] }
      | IncomingTrade[]
      | IncomingTrade;
    const input = Array.isArray(body)
      ? body
      : Array.isArray(body.trades)
        ? body.trades
        : body.trade
          ? [body.trade]
          : [body];
    if (!input.length || input.length > 500)
      throw new Error("Invalid trade batch; use 1 to 500 rows");
    const secrets = await decryptBrokerSecrets(
      connection.credentialsCiphertext,
    );
    const fxRate = ["mt5", "cqg"].includes(connection.provider)
      ? Math.max(1, Number(secrets.fxRate) || 1)
      : 1;
    const rows = input.map((trade) =>
      normalizeTrade(trade, connection, fxRate),
    );
    const result = await ingestTrades(rows, "WEBHOOK", { id: connection.id });
    return Response.json({ ...result, lastSyncAt: new Date().toISOString() });
  } catch (error) {
    return routeError(error);
  }
}
