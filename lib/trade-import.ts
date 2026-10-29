import {QuantV34 as Quant} from '../src/core/quant-v34.js';
export type ImportedJournalTrade = {
  id: string;
  externalId: string;
  date: string;
  symbol: string;
  side: "Buy" | "Sell";
  session: "Châu Á" | "London" | "New York" | "Chưa rõ";
  setup: string;
  timeframe: string;
  risk: number;
  riskKnown?: boolean;
  feesKnown?: boolean;
  pnlKnown?: boolean;
  swap?: number;
  unifiedV6?: Record<string,any>;
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
  numberDecisions?: Array<{field:string;separator:string;ambiguous:boolean;examples:string[]}>;
  needsNumberConfirmation?: boolean;
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
  | "swap"
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
  swap: ["swap", "swapcost", "fundingcost"],
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
  if(/^\d{13}$/.test(text))return new Date(Number(text)).toISOString().slice(0,10);
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
  const iso = text.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
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
  return session.includes('chaua')||session.includes('asia') ? "Châu Á" : "Chưa rõ";
}

function tradeRows(
  rows: unknown[][],
  sourceName: string,
  serialDate?: (serial: number) => string | null,
  separatorOverride?: "." | ",",
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
  const closingColumn=headers.findIndex(h=>['closetime','closedat','closingtime'].includes(h));
  const timeColumns=headers.flatMap((h,i)=>h==='time'?[i]:[]),priceColumns=headers.flatMap((h,i)=>h==='price'?[i]:[]);
  if(closingColumn>=0)positions.date=closingColumn;
  else if(timeColumns.length===2&&priceColumns.length===2){positions.date=timeColumns[1];positions.entryPrice=priceColumns[0];positions.exitPrice=priceColumns[1];}
  const trades: ImportedJournalTrade[] = [];
  const errors: string[] = [];

  const numericNames: Field[]=['pnl','quantity','entryPrice','exitPrice','fees','swap','risk','stopLoss','takeProfit','discipline','durationMin'];
  const numberDecisions=numericNames.filter(field=>positions[field]>=0).map(field=>{const values=dataRows.map(row=>row[positions[field]]);const decision=Quant.decimalSeparator(values,'.');return {field,separator:decision.ambiguous&&separatorOverride?separatorOverride:decision.separator,ambiguous:decision.ambiguous&&values.some(v=>typeof v==='string'&&/[.,]/.test(v)),examples:values.filter(v=>typeof v==='string'&&/[.,]/.test(v)).slice(0,3).map(String)};});
  const columnNumber=(field:Field,value:unknown):number=>{if(value===null||value===undefined||value==='')return 0;const rule=numberDecisions.find(d=>d.field===field);const parsed=Quant.parseNumber(value,rule?.separator||'.');return parsed===null?Number.NaN:Number(parsed);};
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
    const rawPnl = columnNumber("pnl",pnlValue);
    const numericFields: Field[] = [
      "pnl",
      "quantity",
      "entryPrice",
      "exitPrice",
      "fees",
      "swap",
      "risk",
      "stopLoss",
      "takeProfit",
    ];
    if (
      numericFields.some(
        (field) =>
          get(field) !== undefined &&
          String(get(field)).trim() !== "" &&
          !Number.isFinite(columnNumber(field,get(field))),
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
    const sideText = normalizeHeader(get("side") ?? "");
    if(!/^(buy|sell|long|short|mua|ban)(market|limit|stop)?$/.test(sideText)){
      errors.push(`Dòng ${headerIndex + index + 2}: thiếu hoặc không nhận diện được hướng Buy/Sell; không tự gán hướng.`);return;
    }
    const side =
      sideText.includes("sell") ||
      sideText.includes("short") ||
      sideText.includes("ban")
        ? "Sell"
        : "Buy";
    const quantity = columnNumber("quantity",get("quantity"));
    const entryPrice = columnNumber("entryPrice",get("entryPrice"));
    const exitPrice = columnNumber("exitPrice",get("exitPrice"));
    const suppliedRisk = columnNumber("risk",get("risk"));
    if(suppliedRisk<0){errors.push(`Dòng ${headerIndex + index + 2}: rủi ro ban đầu phải dương.`);return;}
    const costIndices=headers.flatMap((h,i)=>ALIASES.fees.includes(h)?[i]:[]);
    const mtSigned=/mt[45]|metatrader/i.test(sourceName)||headers.includes('swap');
    const feesKnown=costIndices.length>0&&costIndices.every(i=>String(row[i]??'').trim()!=='')&&(positions.swap<0||String(get('swap')??'').trim()!=='');
    let fees=0,costInvalid=false;
    for(const i of costIndices){const v=columnNumber('fees',row[i]);if(!Number.isFinite(v))costInvalid=true;else fees+=mtSigned&&headers[i]==='commission'?-v:v;}
    const swapRaw=columnNumber('swap',get('swap'));
    const swap=positions.swap<0?0:headers[positions.swap]==='swap'?-swapRaw:swapRaw;
    if(costInvalid){errors.push(`Dòng ${headerIndex+index+2}: phí không hợp lệ.`);return;}
    const fileNet=/^(netpnl|netprofit|netprofitloss)$/.test(headers[positions.pnl]);
    const feeCurrencyIndex=headers.findIndex(h=>['commissionasset','feecurrency','feecoin'].includes(h));
    const moneyCurrencyIndex=headers.findIndex(h=>['currency','profitcurrency','pnlcurrency','accountcurrency'].includes(h));
    const currency=String(moneyCurrencyIndex<0?'':row[moneyCurrencyIndex]||'').toUpperCase();
    const feeCurrency=String(feeCurrencyIndex<0?'':row[feeCurrencyIndex]||'').toUpperCase();
    const quote=/USDT$/.test(symbol)?'USDT':/USDC$/.test(symbol)?'USDC':currency;
    const compatibleFees=!feeCurrency||!!quote&&feeCurrency===quote;
    const pnl=fileNet?Number(Quant.decimal(rawPnl)!.plus(Quant.decimal(fees)!).plus(Quant.decimal(swap)!)):rawPnl;
    const unifiedV6={...(fileNet?{netPnlSource:'file_net',is_net_pnl_verified:true}:{}),positionSide:String(row[headers.indexOf('positionside')]||''),currency:currency||quote||null,feeCurrency:feeCurrency||null,disciplineKnown:positions.discipline>=0&&String(get('discipline')??'').trim()!=='',importVersion:2};
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
      rawPayloadJson: JSON.stringify({headers:rows[headerIndex],row,unifiedV6}),
      unifiedV6,
      recordKind:
        headers.includes("realizedpnl") &&
        headers.includes("price") &&
        headers.includes("qty")
          || (headers.includes('commission')&&['entry','direction'].some(h=>headers.includes(h)&&/^(in|out|inout|outby)$/i.test(String(row[headers.indexOf(h)])))) ? "fill"
          : "position",
      closedAt: (() => {
        const raw = String(get("date") ?? "");
        if(/^\d{13}$/.test(raw))return new Date(Number(raw)).toISOString();
        const time = /(?:Z|[+-]\d\d:\d\d)$/.test(raw)?Date.parse(raw):NaN;
        return raw.length > 10 && Number.isFinite(time)
          ? new Date(time).toISOString()
          : null;
      })(),
      pnl,
      pnlKnown: compatibleFees,
      discipline: Math.max(0, Math.min(100, columnNumber("discipline",get("discipline")))),
      psychology: String(get("psychology") ?? "").trim() || "Chưa review",
      note: [rawNote, importedNote].filter(Boolean).join(" · "),
      durationMin: Math.max(0, columnNumber("durationMin",get("durationMin"))),
      market: marketFromValue(get("market"), symbol),
      source: String(get("source") ?? "").trim() || `Nhập ${sourceName}`,
      quantity,
      entryPrice,
      stopLoss: columnNumber("stopLoss",get("stopLoss")),
      takeProfit: columnNumber("takeProfit",get("takeProfit")),
      exitPrice,
      fees, swap,
      feesKnown,
    });
  });

  if(errors.length)for(const t of trades){t.unifiedV6={...t.unifiedV6,batchIncomplete:true};const receipt=JSON.parse(t.rawPayloadJson||'{}');t.rawPayloadJson=JSON.stringify({...receipt,unifiedV6:t.unifiedV6});}
  return { trades, errors, detected: dataRows.length, numberDecisions, needsNumberConfirmation:!separatorOverride&&numberDecisions.some(d=>d.ambiguous) };
}

export function parseTradeCsv(
  input: string,
  sourceName = "CSV",
  separatorOverride?: "." | ",",
): TradeImportResult {
  return tradeRows(parseRows(input), sourceName,undefined,separatorOverride);
}

export async function parseTradeWorkbook(
  file: File,
  separatorOverride?: "." | ",",
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
    },separatorOverride);
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
