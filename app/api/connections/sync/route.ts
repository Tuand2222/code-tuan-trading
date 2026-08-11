import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { brokerConnections, trades } from "../../../../db/schema";
import { binanceSignedJson, bybitSignedJson, fetchBrokerBridgeJson } from "../../../../lib/broker-api";
import { decryptBrokerSecrets } from "../../../../lib/broker-crypto";
import { requireUser, routeError } from "../../../../lib/server-auth";

type NormalizedTrade = typeof trades.$inferInsert;
type BrokerSecrets = Awaited<ReturnType<typeof decryptBrokerSecrets>>;
type ConnectionRow = typeof brokerConnections.$inferSelect;

function sessionFor(time: number) {
  const hour = new Date(time).getUTCHours();
  if (hour < 8) return "Châu Á";
  if (hour < 14) return "London";
  return "New York";
}

function brokerAccess(connection: ConnectionRow, secrets: BrokerSecrets) {
  return {
    provider: connection.provider,
    accountType: connection.accountType,
    apiKey: secrets.apiKey,
    apiSecret: secrets.apiSecret,
    bridgeUrl: secrets.bridgeUrl,
    bridgeToken: secrets.bridgeToken,
  };
}

async function binanceTrades(connection: ConnectionRow, secrets: BrokerSecrets, userEmail: string) {
  if (!secrets.apiKey || !secrets.apiSecret) throw new Error("Binance: thông tin API đã lưu không đầy đủ");
  const symbols = secrets.symbols?.length ? secrets.symbols : ["BTCUSDT", "ETHUSDT"];
  const futures = connection.accountType !== "spot";
  const fxRate = secrets.fxRate ?? 1;
  const normalized: NormalizedTrade[] = [];

  for (const symbol of symbols.slice(0, 20)) {
    const { payload } = await binanceSignedJson<Array<Record<string, unknown>>>(
      brokerAccess(connection, secrets),
      { spot: "/api/v3/myTrades", futures: "/fapi/v1/userTrades" },
      { symbol, limit: "500" },
    );
    if (!Array.isArray(payload)) throw new Error(`Binance: dữ liệu ${symbol} không đúng định dạng`);

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
        note: futures
          ? "Binance Futures · setup và rủi ro dự kiến cần review"
          : "Binance Spot execution · P/L, setup và rủi ro cần review",
        durationMin: 0,
      });
    }
  }
  return normalized;
}

async function bybitTrades(connection: ConnectionRow, secrets: BrokerSecrets, userEmail: string) {
  if (!secrets.apiKey || !secrets.apiSecret) throw new Error("Bybit: thông tin API đã lưu không đầy đủ");
  const category = connection.accountType === "spot" ? "spot" : "linear";
  const path = category === "spot" ? "/v5/execution/list" : "/v5/position/closed-pnl";
  const { payload } = await bybitSignedJson<{
    retCode?: number;
    retMsg?: string;
    result?: { list?: Array<Record<string, unknown>> };
  }>(brokerAccess(connection, secrets), path, { category, limit: "100" });
  const fxRate = secrets.fxRate ?? 1;

  return (payload.result?.list ?? []).map((item): NormalizedTrade => {
    const time = Number(item.execTime ?? item.updatedTime ?? item.createdTime);
    const pnl = Number(item.closedPnl ?? 0) * fxRate;
    const quote = Number(
      item.execValue
        ?? item.cumExitValue
        ?? Number(item.execPrice ?? item.avgExitPrice) * Number(item.execQty ?? item.closedSize),
    );
    return {
      id: crypto.randomUUID(),
      userEmail,
      externalId: String(item.execId ?? item.orderId),
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
      fees: Math.abs(Number(item.execFee ?? 0) + Number(item.openFee ?? 0) + Number(item.closeFee ?? 0)) * fxRate,
      quantity: Number(item.execQty ?? item.closedSize ?? item.qty ?? 0),
      entryPrice: Number(item.avgEntryPrice ?? item.execPrice ?? 0),
      exitPrice: Number(item.avgExitPrice ?? item.execPrice ?? 0),
      discipline: 0,
      psychology: "Chưa review",
      note: category === "spot"
        ? "Bybit Spot execution · P/L, setup và rủi ro cần review"
        : "Bybit Derivatives closed P/L · setup và rủi ro dự kiến cần review",
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

async function bridgeTrades(connection: ConnectionRow, secrets: BrokerSecrets, userEmail: string) {
  const profile = BRIDGE_PROFILES[connection.provider];
  if (!profile) throw new Error("Unsupported bridge provider");
  if (!secrets.bridgeUrl || !secrets.bridgeToken) throw new Error(`${profile.source} bridge chưa được cấu hình`);

  const { payload } = await fetchBrokerBridgeJson(brokerAccess(connection, secrets));
  const rows = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as { trades?: unknown }).trades)
      ? (payload as { trades: Array<Record<string, unknown>> }).trades
      : [];
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
    if (!externalId || !symbol) throw new Error(`${profile.source} bridge: mỗi dòng cần externalId và symbol`);

    const time = bridgeTimestamp(item.closedAt ?? item.closeTime ?? item.time ?? item.date);
    const openedAt = bridgeTimestamp(item.openedAt ?? item.openTime, Number.NaN);
    const closedAt = bridgeTimestamp(item.closedAt ?? item.closeTime, Number.NaN);
    const pnl = bridgeNumber(item.profit ?? item.pnl ?? item.realizedPnl) * fxRate;
    const suppliedRisk = bridgeNumber(item.risk ?? item.plannedRisk) * fxRate;
    const suppliedMarket = item.market ?? item.assetClass;
    const market = suppliedMarket ? BRIDGE_MARKETS.get(normalizeKey(suppliedMarket)) : profile.market;
    if (!market) throw new Error(`${profile.source} bridge: market không hợp lệ`);

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
  let failedConnection: ConnectionRow | undefined;
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
    failedConnection = connection;

    const secrets = await decryptBrokerSecrets(connection.credentialsCiphertext);
    let rows: NormalizedTrade[];
    if (connection.provider === "binance") rows = await binanceTrades(connection, secrets, userEmail);
    else if (connection.provider === "bybit") rows = await bybitTrades(connection, secrets, userEmail);
    else if (BRIDGE_PROFILES[connection.provider]) {
      if (connection.accountType === "push") {
        throw new Error("Push 24/7 nhận giao dịch qua secure webhook; không cần đồng bộ thủ công");
      }
      rows = await bridgeTrades(connection, secrets, userEmail);
    } else {
      throw new Error("Kết nối này sử dụng import hoặc webhook thay vì đồng bộ thủ công");
    }

    rows = rows.map((row) => ({
      ...row,
      userId: accountUser.id,
      userEmail: accountUser.email,
    }));
    const imported = rows.length
      ? await getDb().insert(trades).values(rows).onConflictDoNothing().returning()
      : [];
    const now = new Date().toISOString();
    await getDb()
      .update(brokerConnections)
      .set({ status: "connected", lastSyncAt: now, updatedAt: now })
      .where(eq(brokerConnections.id, connection.id));
    return Response.json({ imported: imported.length, scanned: rows.length, trades: imported, lastSyncAt: now });
  } catch (error) {
    if (failedConnection) {
      const now = new Date().toISOString();
      try {
        await getDb()
          .update(brokerConnections)
          .set({ status: "error", updatedAt: now })
          .where(eq(brokerConnections.id, failedConnection.id));
      } catch {
        // Preserve the original provider error.
      }
    }
    return routeError(error);
  }
}
