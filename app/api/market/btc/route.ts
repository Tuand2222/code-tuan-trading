const SUPPORTED_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

type Interval = (typeof SUPPORTED_INTERVALS)[number];
type BinanceKline = [number, string, string, string, string, string, number, string, number, ...unknown[]];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Tuan-Trader-Market-Data/1.0" },
  });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function fetchSpot<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (const base of ["https://api.binance.com", "https://data-api.binance.vision"]) {
    try {
      return await fetchJson<T>(`${base}${path}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Binance market data is unavailable");
}

function normalizeKlines(rows: BinanceKline[]) {
  return rows.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: row[6],
    quoteVolume: Number(row[7]),
    trades: Number(row[8]),
  }));
}

async function getKlines(interval: Interval, limit: number) {
  const rows = await fetchSpot<BinanceKline[]>(
    `/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
  );
  return normalizeKlines(rows);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requested = url.searchParams.get("interval") ?? "1h";
    const interval = SUPPORTED_INTERVALS.includes(requested as Interval)
      ? (requested as Interval)
      : "1h";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 500, 220), 1000);

    if (url.searchParams.get("mode") === "mtf") {
      const rows = await Promise.all(
        SUPPORTED_INTERVALS.slice(1).map(async (timeframe) => [
          timeframe,
          await getKlines(timeframe, 260),
        ] as const),
      );
      return Response.json(
        { source: "Binance", symbol: "BTCUSDT", timeframes: Object.fromEntries(rows) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [candles, ticker, premium, openInterest, ratio] = await Promise.all([
      getKlines(interval, limit),
      fetchSpot<Record<string, string>>("/api/v3/ticker/24hr?symbol=BTCUSDT"),
      fetchJson<Record<string, string>>("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT").catch(() => null),
      fetchJson<Record<string, string>>("https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT").catch(() => null),
      fetchJson<Array<Record<string, string>>>("https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1").catch(() => null),
    ]);

    return Response.json(
      {
        source: "Binance",
        symbol: "BTCUSDT",
        interval,
        serverTime: Date.now(),
        candles,
        ticker: {
          lastPrice: Number(ticker.lastPrice),
          priceChangePercent: Number(ticker.priceChangePercent),
          highPrice: Number(ticker.highPrice),
          lowPrice: Number(ticker.lowPrice),
          quoteVolume: Number(ticker.quoteVolume),
        },
        futures: {
          markPrice: Number(premium?.markPrice ?? 0),
          fundingRate: Number(premium?.lastFundingRate ?? 0),
          nextFundingTime: Number(premium?.nextFundingTime ?? 0),
          openInterest: Number(openInterest?.openInterest ?? 0),
          longShortRatio: Number(ratio?.[0]?.longShortRatio ?? 0),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải dữ liệu BTC" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
