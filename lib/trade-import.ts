export type ImportedJournalTrade = {
  id: string;
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
  recordKind?: string;
  openedAt?: string | null;
  closedAt?: string | null;
  rawPayloadJson?: string;
  pnl: number;
  discipline: number;
  psychology: string;
  note: string;
  durationMin: number;
  market: "Hàng hóa" | "Chứng khoán" | "Crypto" | "Forex";
  source: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number;
  fees: number;
};

export type TradeImportResult = {
  trades: ImportedJournalTrade[];
  errors: string[];
  detected: number;
};

type Field =
  | "date"
  | "symbol"
  | "side"
  | "pnl"
  | "quantity"
  | "entryPrice"
  | "exitPrice"
  | "fees"
  | "externalId"
  | "risk"
  | "setup"
  | "timeframe"
  | "note"
  | "psychology"
  | "market"
  | "source"
  | "session"
  | "stopLoss"
  | "takeProfit"
  | "discipline"
  | "durationMin";

const ALIASES: Record<Field, string[]> = {
  date: [
    "date",
    "datetime",
    "tradedate",
    "ngay",
    "thoigian",
    "time",
    "ngaygiaodich",
    "closetime",
    "opentime",
    "openedat",
    "ngaymo",
  ],
  symbol: [
    "symbol",
    "ticker",
    "mack",
    "ma",
    "capgiaodich",
    "instrument",
    "sanpham",
    "product",
  ],
  side: [
    "side",
    "type",
    "ordertype",
    "muaban",
    "mualban",
    "loailenh",
    "huong",
    "lenh",
    "positionside",
  ],
  pnl: [
    "pnl",
    "profit",
    "profitloss",
    "lailo",
    "loinhuan",
    "realizedpnl",
    "closedpnl",
    "netpnl",
  ],
  quantity: [
    "quantity",
    "qty",
    "khoiluong",
    "volume",
    "closedquantity",
    "size",
    "soluong",
  ],
  entryPrice: [
    "entryprice",
    "openprice",
    "giamolenh",
    "giavao",
    "giakhop",
    "entry",
    "avgentryprice",
    "averageentryprice",
    "price",
    "giamotrungbinh",
  ],
  exitPrice: [
    "exitprice",
    "closeprice",
    "giadong",
    "giadonglenh",
    "giadongtrungbinh",
    "averagecloseprice",
    "exit",
    "avgexitprice",
    "averageexitprice",
  ],
  fees: [
    "fee",
    "fees",
    "commission",
    "hoahongphi",
    "commissionfee",
    "tradingfee",
    "phi",
    "phigiaodich",
  ],
  externalId: [
    "externalid",
    "tradeid",
    "orderid",
    "ticket",
    "deal",
    "mangoai",
    "id",
  ],
  risk: ["risk", "plannedrisk", "ruiro", "riskamount"],
  setup: ["setup", "strategy", "chienluoc", "mohinh"],
  timeframe: ["timeframe", "tf", "khungthoigian"],
  note: ["note", "notes", "comment", "ghichu"],
  psychology: ["psychology", "tamly", "emotion"],
  market: ["market", "thitruong"],
  source: ["source", "nguon", "nguondulieu", "broker"],
  session: ["session", "phien"],
  stopLoss: ["stoploss", "sl", "catlo"],
  takeProfit: ["takeprofit", "tp", "chotloi"],
  discipline: ["discipline", "kyluat"],
  durationMin: ["durationmin", "thoiluongphut"],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], field: Field) {
  const aliases = ALIASES[field];
  const exact = headers.findIndex((header) => aliases.includes(header));
  if (exact >= 0) return exact;
  return headers.findIndex((header) =>
    aliases.some((alias) => alias.length >= 5 && header.includes(alias)),
  );
}

function parseRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].sort(
    (left, right) =>
      firstLine.split(right).length - firstLine.split(left).length,
  )[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function rowToString(row: unknown[]) {
  return row.map((value) => String(value ?? "").trim()).join("|");
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const source = String(value ?? "").trim();
  if (!source) return 0;
  const negative = /^\(.*\)$/.test(source);
  const cleaned = source.replace(/[()\s$€£₫]/g, "").replace(/[^0-9,.-]/g, "");
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (comma >= 0 && dot >= 0) {
    normalized =
      comma > dot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    const decimals = cleaned.length - cleaned.lastIndexOf(separator) - 1;
    normalized =
      decimals === 3
        ? cleaned.replaceAll(separator, "")
        : cleaned.replace(separator, ".");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && /[0-9]/.test(cleaned)
    ? negative
      ? -Math.abs(parsed)
      : parsed
    : Number.NaN;
}

function dateFromValue(
  value: unknown,
  serialDate?: (serial: number) => string | null,
): string | null {
  if (value instanceof Date && Number.isFinite(value.valueOf())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && serialDate) return serialDate(value);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const formatParts = (year: number, month: number, day: number) => {
    const checked = new Date(Date.UTC(year, month - 1, day));
    if (
      checked.getUTCFullYear() !== year ||
      checked.getUTCMonth() !== month - 1 ||
      checked.getUTCDate() !== day
    )
      return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return formatParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (local) {
    let [, first, second, year] = local;
    let day = Number(first);
    let month = Number(second);
    if (day <= 12 && month > 12) [day, month] = [month, day];
    return formatParts(Number(year), month, day);
  }
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.valueOf())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function marketFromValue(
  value: unknown,
  symbol: string,
): ImportedJournalTrade["market"] {
  const market = normalizeHeader(value);
  if (market.includes("crypto") || market.includes("coin")) return "Crypto";
  if (market.includes("forex") || market.includes("fx")) return "Forex";
  if (market.includes("chungkhoan") || market.includes("stock"))
    return "Chứng khoán";
  if (market.includes("hanghoa") || market.includes("commodity"))
    return "Hàng hóa";
  if (/USDT$|USDC$|BTC$|ETH$/.test(symbol)) return "Crypto";
  if (/^(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY|XAU|XAG)[A-Z]{3}$/.test(symbol))
    return "Forex";
  return "Hàng hóa";
}

function sessionFromValue(value: unknown): ImportedJournalTrade["session"] {
  const session = normalizeHeader(value);
  if (session.includes("london")) return "London";
  if (session.includes("newyork") || session === "ny") return "New York";
  return "Châu Á";
}

function tradeRows(
  rows: unknown[][],
  sourceName: string,
  serialDate?: (serial: number) => string | null,
): TradeImportResult {
  const headerIndex = rows.slice(0, 40).findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return (
      findColumn(headers, "date") >= 0 &&
      findColumn(headers, "symbol") >= 0 &&
      findColumn(headers, "pnl") >= 0
    );
  });
  if (headerIndex < 0)
    return {
      trades: [],
      errors: [
        "Không tìm thấy hàng tiêu đề có Ngày, Sản phẩm/Symbol và Lãi/Lỗ/P&L.",
      ],
      detected: 0,
    };

  const headers = rows[headerIndex].map(normalizeHeader);
  const positions = Object.fromEntries(
    (Object.keys(ALIASES) as Field[]).map((field) => [
      field,
      findColumn(headers, field),
    ]),
  ) as Record<Field, number>;
  const dataRows = rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""));
  const trades: ImportedJournalTrade[] = [];
  const errors: string[] = [];

  dataRows.forEach((row, index) => {
    const get = (field: Field) =>
      positions[field] >= 0 ? row[positions[field]] : undefined;
    const symbol = String(get("symbol") ?? "")
      .trim()
      .toUpperCase();
    const date = dateFromValue(get("date"), serialDate);
    const pnlValue = get("pnl");
    if (
      !symbol ||
      !date ||
      pnlValue === undefined ||
      String(pnlValue).trim() === ""
    ) {
      errors.push(
        `Dòng ${headerIndex + index + 2}: thiếu ngày, mã giao dịch hoặc P&L.`,
      );
      return;
    }
    const pnl = parseNumber(pnlValue);
    const numericFields: Field[] = [
      "pnl",
      "quantity",
      "entryPrice",
      "exitPrice",
      "fees",
      "risk",
      "stopLoss",
      "takeProfit",
    ];
    if (
      numericFields.some(
        (field) =>
          get(field) !== undefined &&
          String(get(field)).trim() !== "" &&
          !Number.isFinite(parseNumber(get(field))),
      )
    ) {
      errors.push(
        `Dòng ${headerIndex + index + 2}: số không hợp lệ, chưa nhập dòng này.`,
      );
      return;
    }
    const externalValue = String(get("externalId") ?? "").trim();
    const rowKey = rowToString(row);
    const externalId = externalValue || `import-${stableHash(rowKey)}-${index}`;
    const sideText = normalizeHeader(get("side") ?? "buy");
    const side =
      sideText.includes("sell") ||
      sideText.includes("short") ||
      sideText.includes("ban")
        ? "Sell"
        : "Buy";
    const quantity = parseNumber(get("quantity"));
    const entryPrice = parseNumber(get("entryPrice"));
    const exitPrice = parseNumber(get("exitPrice"));
    const suppliedRisk = Math.abs(parseNumber(get("risk")));
    const rawNote = String(get("note") ?? "").trim();
    const importedNote = `Nhập từ ${sourceName}`;
    trades.push({
      id: crypto.randomUUID(),
      externalId,
      date,
      symbol,
      side,
      session: sessionFromValue(get("session")),
      setup: String(get("setup") ?? "").trim() || "Chưa phân loại",
      timeframe: String(get("timeframe") ?? "").trim() || "—",
      risk: suppliedRisk,
      riskKnown: suppliedRisk > 0,
      rawPayloadJson: JSON.stringify(row),
      recordKind:
        headers.includes("realizedpnl") &&
        headers.includes("price") &&
        headers.includes("qty")
          ? "fill"
          : "position",
      closedAt: (() => {
        const raw = String(get("date") ?? "");
        const time = Date.parse(raw);
        return raw.length > 10 && Number.isFinite(time)
          ? new Date(time).toISOString()
          : null;
      })(),
      pnl,
      discipline: Math.max(0, Math.min(100, parseNumber(get("discipline")))),
      psychology: String(get("psychology") ?? "").trim() || "Chưa review",
      note: [rawNote, importedNote].filter(Boolean).join(" · "),
      durationMin: Math.max(0, parseNumber(get("durationMin"))),
      market: marketFromValue(get("market"), symbol),
      source: String(get("source") ?? "").trim() || `Nhập ${sourceName}`,
      quantity,
      entryPrice,
      stopLoss: parseNumber(get("stopLoss")),
      takeProfit: parseNumber(get("takeProfit")),
      exitPrice,
      fees: Math.abs(parseNumber(get("fees"))),
      feesKnown: positions.fees >= 0 && String(get("fees") ?? "").trim() !== "",
    });
  });

  return { trades, errors, detected: dataRows.length };
}

export function parseTradeCsv(
  input: string,
  sourceName = "CSV",
): TradeImportResult {
  return tradeRows(parseRows(input), sourceName);
}

export async function parseTradeWorkbook(
  file: File,
): Promise<TradeImportResult> {
  const XLSX = (await import("xlsx-js-style")).default;
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const preferred =
    workbook.SheetNames.find(
      (name) => normalizeHeader(name) === "lichsugiaodichchitiet",
    ) ??
    workbook.SheetNames.find(
      (name) => normalizeHeader(name) === "lichsuchitiet",
    );
  const sheetNames = preferred
    ? [preferred, ...workbook.SheetNames.filter((name) => name !== preferred)]
    : workbook.SheetNames;
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
    }) as unknown[][];
    const result = tradeRows(rows, "Excel", (serial) => {
      const parts = XLSX.SSF.parse_date_code(serial);
      if (!parts) return null;
      return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
    });
    if (result.detected || result.trades.length) return result;
  }
  return {
    trades: [],
    errors: [
      "Không tìm thấy sheet có cột Ngày, Sản phẩm/Symbol và Lãi/Lỗ/P&L.",
    ],
    detected: 0,
  };
}
