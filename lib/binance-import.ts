export type BinanceImportedTrade = {
  externalId: string;
  date: string;
  symbol: string;
  side: "Buy" | "Sell";
  session: "Châu Á" | "London" | "New York";
  setup: string;
  timeframe: string;
  risk: number;
  riskKnown?: boolean;
  feesKnown?: boolean;
  openedAt?: string | null;
  closedAt?: string | null;
  pnl: number;
  discipline: number;
  psychology: string;
  note: string;
  durationMin: number;
  market: "Crypto";
  source: "Binance Futures PDF" | "Binance Futures CSV";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  fees: number;
};

export type BinanceParseResult = {
  trades: BinanceImportedTrade[];
  errors: string[];
  detected: number;
};

const ROW_PATTERN =
  /([A-Z0-9][A-Z0-9_]{2,})\s+(Cross|Isolated)\s+(Long|Short)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(Closed|Open)/g;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizePdfText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[，,]/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function toDate(value: string) {
  return value.slice(0, 10);
}

function durationMinutes(openedAt: string, closedAt: string) {
  const start = Date.parse(openedAt.replace(" ", "T") + "Z");
  const end = Date.parse(closedAt.replace(" ", "T") + "Z");
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.round((end - start) / 60000)
    : 0;
}

export function parseBinanceFuturesText(input: string): BinanceParseResult {
  const text = normalizePdfText(input);
  const trades: BinanceImportedTrade[] = [];
  const errors: string[] = [];
  const matchedSpans: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  const occurrence = new Map<string, number>();

  ROW_PATTERN.lastIndex = 0;
  while ((match = ROW_PATTERN.exec(text))) {
    matchedSpans.push([match.index, ROW_PATTERN.lastIndex]);
    const [
      ,
      symbol,
      marginMode,
      positionSide,
      entry,
      exit,
      maxUnrealizedPnl,
      quantity,
      pnl,
      openedAt,
      closedAt,
      status,
    ] = match;
    const rawKey = [
      symbol,
      marginMode,
      positionSide,
      entry,
      exit,
      quantity,
      pnl,
      openedAt,
      closedAt,
      status,
    ].join("|");
    const realizedPnl = Number(pnl);
    const closedQuantity = Number(quantity);
    const entryPrice = Number(entry);
    const exitPrice = Number(exit);
    if (
      status !== "Closed" ||
      !Number.isFinite(realizedPnl) ||
      !Number.isFinite(closedQuantity) ||
      !Number.isFinite(entryPrice) ||
      !Number.isFinite(exitPrice)
    ) {
      errors.push(`${symbol ?? "Không rõ mã"}: dữ liệu vị thế không hợp lệ`);
      continue;
    }
    const ordinal = occurrence.get(rawKey) ?? 0;
    occurrence.set(rawKey, ordinal + 1);
    trades.push({
      externalId: `import-binance-pdf-${stableHash(rawKey)}-${ordinal}`,
      date: toDate(closedAt),
      symbol,
      side: positionSide === "Short" ? "Sell" : "Buy",
      session:
        Number(openedAt.slice(11, 13)) < 8
          ? "Châu Á"
          : Number(openedAt.slice(11, 13)) < 14
            ? "London"
            : "New York",
      setup: "Chưa phân loại",
      timeframe: "—",
      risk: 0,
      riskKnown: false,
      feesKnown: false,
      openedAt: openedAt.replace(" ", "T") + "Z",
      closedAt: closedAt.replace(" ", "T") + "Z",
      pnl: realizedPnl,
      discipline: 0,
      psychology: "Chưa review",
      note: `Binance Futures · ${marginMode} · ${positionSide} · Max unrealized PNL: ${maxUnrealizedPnl} · Mở: ${openedAt} UTC · Đóng: ${closedAt} UTC`,
      durationMin: durationMinutes(openedAt, closedAt),
      market: "Crypto",
      source: "Binance Futures PDF",
      quantity: closedQuantity,
      entryPrice,
      exitPrice,
      fees: 0,
    });
  }

  const unmatchedLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        /^[A-Z0-9][A-Z0-9_]{2,}\s+(Cross|Isolated)\s+(Long|Short)/.test(line) &&
        !line.includes("Closed"),
    );
  for (const line of unmatchedLines.slice(0, 20))
    errors.push(`Không parse được dòng: ${line.slice(0, 180)}`);

  return { trades, errors, detected: matchedSpans.length };
}

export function parseBinanceCsvText(input: string): BinanceParseResult {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2)
    return { trades: [], errors: ["CSV không có dữ liệu"], detected: 0 };
  const delimiter = rows[0].includes(";") ? ";" : ",";
  const headers = rows[0]
    .split(delimiter)
    .map((header) => header.trim().toLowerCase());
  const find = (...names: string[]) =>
    names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ??
    -1;
  const symbolIndex = find("symbol", "mã", "ticker");
  const pnlIndex = find("closed pnl", "pnl", "realized pnl", "lãi/lỗ");
  const dateIndex = find("open time", "opened at", "date", "ngày");
  const sideIndex = find("position side", "side", "hướng");
  const quantityIndex = find(
    "closed quantity",
    "quantity",
    "qty",
    "khối lượng",
  );
  const entryIndex = find("entry price", "entry", "giá vào lệnh");
  const exitIndex = find(
    "average close price",
    "exit price",
    "exit",
    "giá đóng trung bình",
  );
  if (symbolIndex < 0 || pnlIndex < 0 || dateIndex < 0)
    return {
      trades: [],
      errors: ["CSV thiếu cột Symbol, PNL hoặc thời gian mở"],
      detected: 0,
    };
  const trades: BinanceImportedTrade[] = [];
  const errors: string[] = [];
  for (const [rowIndex, row] of rows.slice(1).entries()) {
    const cells = row.split(delimiter).map((cell) => cell.trim());
    const symbol = cells[symbolIndex]?.toUpperCase();
    const pnl = Number(cells[pnlIndex]);
    if (!symbol || !Number.isFinite(pnl)) {
      errors.push(`Dòng ${rowIndex + 2}: Symbol hoặc PNL không hợp lệ`);
      continue;
    }
    const openedAt = cells[dateIndex] ?? "";
    const side = /short|sell|bán/i.test(cells[sideIndex] ?? "")
      ? "Sell"
      : "Buy";
    const quantity = Number(cells[quantityIndex] ?? 0) || 0;
    const entryPrice = Number(cells[entryIndex] ?? 0) || 0;
    const exitPrice = Number(cells[exitIndex] ?? 0) || 0;
    const rawKey = [
      symbol,
      openedAt,
      quantity,
      pnl,
      entryPrice,
      exitPrice,
    ].join("|");
    trades.push({
      externalId: `binance-csv-${stableHash(rawKey)}`,
      date: /^\d{4}-\d{2}-\d{2}/.test(openedAt)
        ? openedAt.slice(0, 10)
        : new Date(openedAt).toISOString().slice(0, 10),
      symbol,
      side,
      session: "New York",
      setup: "Chưa phân loại",
      timeframe: "—",
      risk: Math.max(Math.abs(pnl), 1),
      pnl,
      discipline: 0,
      psychology: "Chưa review",
      note: "Binance Futures · nhập từ CSV",
      durationMin: 0,
      market: "Crypto",
      source: "Binance Futures CSV",
      quantity,
      entryPrice,
      exitPrice,
      fees: 0,
    });
  }
  return { trades, errors, detected: rows.length - 1 };
}
