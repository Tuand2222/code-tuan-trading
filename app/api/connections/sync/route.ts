import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { brokerConnections, trades } from "../../../../db/schema";
import { decryptBrokerSecrets } from "../../../../lib/broker-crypto";
import { getPublicBridgeUrl } from "../../../../lib/bridge-url";
import { requireUser, routeError } from "../../../../lib/server-auth";

type NormalizedTrade = typeof trades.$inferInsert;

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

function sessionFor(time: number) {
  const hour = new Date(time).getUTCHours();
  if (hour < 8) return "Châu Á";
  if (hour < 14) return "London";
  return "New York";
}

async function binanceTrades(
  connection: typeof brokerConnections.$inferSelect,
  secrets: Awaited<ReturnType<typeof decryptBrokerSecrets>>,
  userEmail: string,
) {
  if (!secrets.apiKey || !secrets.apiSecret) throw new Error("Binance credentials are missing");
  const symbols = secrets.symbols?.length ? secrets.symbols : ["BTCUSDT", "ETHUSDT"];
  const futures = connection.accountType !== "spot";
  const host = futures ? "https://fapi.binance.com" : "https://api.binance.com";
  const path = futures ? "/fapi/v1/userTrades" : "/api/v3/myTrades";
  const fxRate = secrets.fxRate ?? 1;
  const normalized: NormalizedTrade[] = [];
  for (const symbol of symbols.slice(0, 20)) {
    const query = new URLSearchParams({
      symbol,
      timestamp: String(Date.now()),
      recvWindow: "5000",
      limit: "500",
    }).toString();
    const signature = await hmacHex(secrets.apiSecret, query);
    const response = await fetch(`${host}${path}?${query}&signature=${signature}`, {
      headers: { "X-MBX-APIKEY": secrets.apiKey },
    });
    const payload = (await response.json()) as Array<Record<string, unknown>> | { msg?: string };
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(`Binance: ${Array.isArray(payload) ? response.statusText : payload.msg ?? response.statusText}`);
    }
    for (const item of payload) {
      const time = Number(item.time);
      const quote = Number(item.quoteQty ?? Number(item.price) * Number(item.qty));
      const pnl = Number(item.realizedPnl ?? 0) * fxRate;
      normalized.push({
        id: crypto.randomUUID(),
        userEmail,
        externalId: `${symbol}:${String(item.id)}`,
        market: "Crypto",
        source: "Binance",
        accountId: connection.id,
        date: new Date(time).toISOString().slice(0, 10),
        symbol,
        side: item.buyer === true || String(item.side).toUpperCase() === "BUY" ? "Buy" : "Sell",
        session: sessionFor(time),
        setup: "Chưa phân loại",
        timeframe: "Auto",
        risk: Math.max(Math.abs(pnl), quote * fxRate * 0.01, 1),
        pnl,
        fees: Number(item.commission ?? 0) * fxRate,
        quantity: Number(item.qty ?? 0),
        entryPrice: Number(item.price ?? 0),
        exitPrice: Number(item.price ?? 0),
        discipline: 0,
        psychology: "Chưa review",
        note: futures ? "Binance Futures · setup và rủi ro dự kiến cần review" : "Binance Spot execution · P/L, setup và rủi ro cần review",
        durationMin: 0,
      });
    }
  }
  return normalized;
}

async function bybitTrades(
  connection: typeof brokerConnections.$inferSelect,
  secrets: Awaited<ReturnType<typeof decryptBrokerSecrets>>,
  userEmail: string,
) {
  if (!secrets.apiKey || !secrets.apiSecret) throw new Error("Bybit credentials are missing");
  const category = connection.accountType === "spot" ? "spot" : "linear";
  const query = new URLSearchParams({ category, limit: "100" }).toString();
  const timestamp = String(Date.now());
  const receiveWindow = "5000";
  const signature = await hmacHex(
    secrets.apiSecret,
    `${timestamp}${secrets.apiKey}${receiveWindow}${query}`,
  );
  const response = await fetch(`https://api.bybit.com/v5/execution/list?${query}`, {
    headers: {
      "X-BAPI-API-KEY": secrets.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": receiveWindow,
      "X-BAPI-SIGN": signature,
    },
  });
  const payload = (await response.json()) as {
    retCode?: number;
    retMsg?: string;
    result?: { list?: Array<Record<string, unknown>> };
  };
  if (!response.ok || payload.retCode !== 0) throw new Error(`Bybit: ${payload.retMsg ?? response.statusText}`);
  const fxRate = secrets.fxRate ?? 1;
  return (payload.result?.list ?? []).map((item): NormalizedTrade => {
    const time = Number(item.execTime);
    const pnl = Number(item.closedPnl ?? item.execPnl ?? 0) * fxRate;
    const quote = Number(item.execValue ?? Number(item.execPrice) * Number(item.execQty));
    return {
      id: crypto.randomUUID(),
      userEmail,
      externalId: String(item.execId),
      market: "Crypto",
      source: "Bybit",
      accountId: connection.id,
      date: new Date(time).toISOString().slice(0, 10),
      symbol: String(item.symbol ?? "UNKNOWN"),
      side: String(item.side).toLowerCase() === "sell" ? "Sell" : "Buy",
      session: sessionFor(time),
      setup: "Chưa phân loại",
      timeframe: "Auto",
      risk: Math.max(Math.abs(pnl), quote * fxRate * 0.01, 1),
      pnl,
      fees: Number(item.execFee ?? 0) * fxRate,
      quantity: Number(item.execQty ?? 0),
      entryPrice: Number(item.execPrice ?? 0),
      exitPrice: Number(item.execPrice ?? 0),
      discipline: 0,
      psychology: "Chưa review",
      note: category === "spot" ? "Bybit Spot execution · P/L, setup và rủi ro cần review" : "Bybit Derivatives · setup và rủi ro dự kiến cần review",
      durationMin: 0,
    };
  });
}

const BRIDGE_PROFILES: Record<string, { market: string; source: string; note: string }> = {
  vps: {
    market: "Chứng khoán",
    source: "VPS",
    note: "VPS bridge · setup và rủi ro dự kiến cần review",
  },
  ssi: {
    market: "Chứng khoán",
    source: "SSI FastConnect",
    note: "SSI FastConnect bridge · setup và rủi ro dự kiến cần review",
  },
  tcx: {
    market: "Chứng khoán",
    source: "TCX / TCBS",
    note: "TCX / TCBS bridge · setup và rủi ro dự kiến cần review",
  },
  mt5: {
    market: "Forex",
    source: "MetaTrader 5",
    note: "MetaTrader 5 · setup và rủi ro dự kiến cần review",
  },
  cqg: {
    market: "Hàng hóa",
    source: "CQG",
    note: "CQG bridge · setup và rủi ro dự kiến cần review",
  },
};

const BRIDGE_MARKETS = new Map<string, string>([
  ["hanghoa", "Hàng hóa"],
  ["commodity", "Hàng hóa"],
  ["commodities", "Hàng hóa"],
  ["chungkhoan", "Chứng khoán"],
  ["cophieu", "Chứng khoán"],
  ["stock", "Chứng khoán"],
  ["stocks", "Chứng khoán"],
  ["equity", "Chứng khoán"],
  ["forex", "Forex"],
  ["fx", "Forex"],
  ["crypto", "Crypto"],
  ["coin", "Crypto"],
]);

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function bridgeTimestamp(value: unknown, fallback = Date.now()) {
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bridgeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function bridgeTrades(
  connection: typeof brokerConnections.$inferSelect,
  secrets: Awaited<ReturnType<typeof decryptBrokerSecrets>>,
  userEmail: string,
) {
  const profile = BRIDGE_PROFILES[connection.provider];
  if (!profile) throw new Error("Unsupported bridge provider");
  if (!secrets.bridgeUrl || !secrets.bridgeToken) throw new Error(`${profile.source} bridge is not configured`);
  const url = getPublicBridgeUrl(secrets.bridgeUrl);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secrets.bridgeToken}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${profile.source} bridge: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { trades?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  const rows = Array.isArray(payload) ? payload : payload.trades ?? [];
  const fxRate = secrets.fxRate ?? 1;
  return rows.slice(0, 1000).map((item): NormalizedTrade => {
    const externalId = String(
      item.externalId
        ?? item.tradeId
        ?? item.dealId
        ?? item.executionId
        ?? item.matchId
        ?? item.orderId
        ?? item.orderID
        ?? item.ticket
        ?? item.id
        ?? "",
    ).trim();
    const symbol = String(item.symbol ?? item.ticker ?? item.instrument ?? "").trim().toUpperCase();
    if (!externalId || !symbol) throw new Error(`${profile.source} bridge row needs externalId and symbol`);
    const time = bridgeTimestamp(item.closedAt ?? item.closeTime ?? item.time ?? item.date);
    const openedAt = bridgeTimestamp(item.openedAt ?? item.openTime, Number.NaN);
    const closedAt = bridgeTimestamp(item.closedAt ?? item.closeTime, Number.NaN);
    const pnl = bridgeNumber(item.profit ?? item.pnl ?? item.realizedPnl) * fxRate;
    const suppliedRisk = bridgeNumber(item.risk ?? item.plannedRisk) * fxRate;
    const suppliedMarket = item.market ?? item.assetClass;
    const market = suppliedMarket ? BRIDGE_MARKETS.get(normalizeKey(suppliedMarket)) : profile.market;
    if (!market) throw new Error(`${profile.source} bridge row has an invalid market`);
    const setup = String(item.setup ?? "").trim() || "Chưa phân loại";
    const durationMin = Number.isFinite(openedAt) && Number.isFinite(closedAt)
      ? Math.max(0, Math.round((closedAt - openedAt) / 60000))
      : Math.max(0, bridgeNumber(item.durationMin));
    const reviewNotes = [
      String(item.note ?? "").trim(),
      suppliedRisk > 0 ? "" : "Rủi ro dự kiến cần review",
      setup === "Chưa phân loại" ? "Setup cần phân loại" : "",
    ].filter(Boolean);
    return {
      id: crypto.randomUUID(),
      userEmail,
      externalId,
      market,
      source: profile.source,
      accountId: connection.id,
      date: new Date(time).toISOString().slice(0, 10),
      symbol,
      side: ["sell", "short", "ban"].some((word) => normalizeKey(item.type ?? item.side).includes(word)) ? "Sell" : "Buy",
      session: String(item.session ?? sessionFor(time)),
      setup,
      timeframe: String(item.timeframe ?? "Auto"),
      risk: suppliedRisk > 0 ? suppliedRisk : Math.max(Math.abs(pnl), 1),
      pnl,
      fees: Math.abs(bridgeNumber(item.fees ?? item.fee ?? item.commission) * fxRate),
      quantity: Math.abs(bridgeNumber(item.volume ?? item.quantity ?? item.qty)),
      entryPrice: bridgeNumber(item.openPrice ?? item.entryPrice ?? item.price),
      exitPrice: bridgeNumber(item.closePrice ?? item.exitPrice ?? item.price),
      discipline: Math.max(0, Math.min(100, bridgeNumber(item.discipline))),
      psychology: String(item.psychology ?? "Chưa review"),
      note: [profile.note, ...reviewNotes].filter(Boolean).join(" · "),
      durationMin,
    };
  });
}

export async function POST(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const userEmail = accountUser.email;
    const { connectionId } = (await request.json()) as { connectionId?: string };
    if (!connectionId) throw new Error("Connection id is required");
    const [connection] = await getDb()
      .select()
      .from(brokerConnections)
      .where(and(eq(brokerConnections.id, connectionId), eq(brokerConnections.userId, accountUser.id)))
      .limit(1);
    if (!connection) throw new Error("Connection not found");
    const secrets = await decryptBrokerSecrets(connection.credentialsCiphertext);
    let rows: NormalizedTrade[];
    if (connection.provider === "binance") rows = await binanceTrades(connection, secrets, userEmail);
    else if (connection.provider === "bybit") rows = await bybitTrades(connection, secrets, userEmail);
    else if (BRIDGE_PROFILES[connection.provider]) {
      if (connection.accountType === "push") throw new Error("Push 24/7 receives trades through the secure webhook; manual sync is not needed");
      rows = await bridgeTrades(connection, secrets, userEmail);
    }
    else throw new Error("This connection uses import or webhook instead of manual sync");
    rows = rows.map((row) => ({
      ...row,
      userId: accountUser.id,
      userEmail: accountUser.email,
    }));
    const imported = rows.length
      ? await getDb().insert(trades).values(rows).onConflictDoNothing().returning()
      : [];
    const now = new Date().toISOString();
    await getDb().update(brokerConnections).set({ status: "connected", lastSyncAt: now, updatedAt: now }).where(eq(brokerConnections.id, connection.id));
    return Response.json({ imported: imported.length, scanned: rows.length, trades: imported, lastSyncAt: now });
  } catch (error) {
    return routeError(error);
  }
}
