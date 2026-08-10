import XLSX from "xlsx-js-style";

export type ExcelTrade = {
  id: string;
  date: string;
  symbol: string;
  market?: string;
  source?: string;
  accountId?: string | null;
  externalId?: string | null;
  side: "Buy" | "Sell";
  session: string;
  setup: string;
  timeframe: string;
  risk: number;
  pnl: number;
  fees?: number;
  quantity?: number;
  entryPrice?: number;
  exitPrice?: number;
  discipline: number;
  psychology: string;
  durationMin: number;
  note: string;
  openedAt?: string | null;
  closedAt?: string | null;
  stopLoss?: number;
  takeProfit?: number;
  swap?: number;
  pips?: number;
};

type CellStyle = NonNullable<XLSX.CellObject["s"]>;

const COLORS = {
  ink: "0B1220",
  panel: "111A28",
  panelSoft: "1A2637",
  gold: "F3B83E",
  goldSoft: "FFF2CC",
  white: "FFFFFF",
  text: "1F2937",
  muted: "64748B",
  border: "D7DEE8",
  green: "15803D",
  greenSoft: "DCFCE7",
  red: "C2414A",
  redSoft: "FEE2E2",
  blue: "2563EB",
  blueSoft: "DBEAFE",
  graySoft: "F1F5F9",
};

const MONEY_FORMAT = "#,##0;[Red](#,##0);-";
const NUMBER_FORMAT = "#,##0.00;[Red](#,##0.00);-";
const INTEGER_FORMAT = "#,##0;[Red](#,##0);-";
const PERCENT_FORMAT = "0.0%";
const R_FORMAT = "0.00\"R\";[Red](0.00\"R\");-";
const DATE_FORMAT = "yyyy-mm-dd";
const DATETIME_FORMAT = "yyyy-mm-dd hh:mm:ss";
const HISTORY_START_ROW = 6;
const HISTORY_MAX_ROW = 5005;

const thinBorder = {
  top: { style: "thin", color: { rgb: COLORS.border } },
  bottom: { style: "thin", color: { rgb: COLORS.border } },
  left: { style: "thin", color: { rgb: COLORS.border } },
  right: { style: "thin", color: { rgb: COLORS.border } },
} satisfies CellStyle["border"];

const titleStyle: CellStyle = {
  fill: { fgColor: { rgb: COLORS.ink } },
  font: { name: "Aptos Display", sz: 18, bold: true, color: { rgb: COLORS.white } },
  alignment: { vertical: "center", horizontal: "left" },
};

const sectionStyle: CellStyle = {
  fill: { fgColor: { rgb: COLORS.panel } },
  font: { name: "Aptos", sz: 11, bold: true, color: { rgb: COLORS.white } },
  alignment: { vertical: "center", horizontal: "left" },
};

const headerStyle: CellStyle = {
  fill: { fgColor: { rgb: COLORS.panelSoft } },
  font: { name: "Aptos", sz: 10, bold: true, color: { rgb: COLORS.white } },
  alignment: { vertical: "center", horizontal: "center", wrapText: true },
  border: thinBorder,
};

const bodyStyle: CellStyle = {
  fill: { fgColor: { rgb: COLORS.white } },
  font: { name: "Aptos", sz: 10, color: { rgb: COLORS.text } },
  alignment: { vertical: "center" },
  border: thinBorder,
};

const formulaStyle: CellStyle = {
  ...bodyStyle,
  font: { name: "Aptos", sz: 10, color: { rgb: COLORS.text } },
};

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toExcelDate(value?: string | null, dateOnly = false) {
  if (!value) return "";
  const date = dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date;
}

function monthKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "Không xác định";
}

function weekday(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return "Không xác định";
  return ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"][date.getDay()];
}

function excelText(value: string) {
  return value.replaceAll('"', '""');
}

function formulaCell(formula: string, value: number | string, numFmt?: string, style: CellStyle = formulaStyle): XLSX.CellObject {
  return {
    t: typeof value === "number" ? "n" : "s",
    v: value,
    f: formula.startsWith("=") ? formula.slice(1) : formula,
    s: { ...style, ...(numFmt ? { numFmt } : {}) },
  };
}

function styleRange(sheet: XLSX.WorkSheet, range: string, style: CellStyle) {
  const decoded = XLSX.utils.decode_range(range);
  for (let row = decoded.s.r; row <= decoded.e.r; row += 1) {
    for (let column = decoded.s.c; column <= decoded.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (!sheet[address]) sheet[address] = { t: "s", v: "" };
      sheet[address].s = { ...style, ...(sheet[address].s || {}) };
    }
  }
}

function setTitle(sheet: XLSX.WorkSheet, range: string, title: string, subtitle: string, lastColumn: string) {
  const currentRange = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : XLSX.utils.decode_range(range);
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: {
      r: Math.max(currentRange.e.r, 2),
      c: Math.max(currentRange.e.c, XLSX.utils.decode_col(lastColumn)),
    },
  });
  sheet.A1 = { t: "s", v: title, s: titleStyle };
  sheet.A3 = {
    t: "s",
    v: subtitle,
    s: {
      fill: { fgColor: { rgb: COLORS.goldSoft } },
      font: { name: "Aptos", sz: 10, italic: true, color: { rgb: COLORS.text } },
      alignment: { vertical: "center", wrapText: true },
    },
  };
  sheet["!merges"] = [
    ...(sheet["!merges"] || []),
    XLSX.utils.decode_range(range),
    XLSX.utils.decode_range(`A3:${lastColumn}3`),
  ];
  styleRange(sheet, range, titleStyle);
  styleRange(sheet, `A3:${lastColumn}3`, sheet.A3.s || bodyStyle);
  sheet["!rows"] = [{ hpt: 28 }, { hpt: 28 }, { hpt: 32 }];
}

function applyHeader(sheet: XLSX.WorkSheet, range: string) {
  styleRange(sheet, range, headerStyle);
}

function applyBody(sheet: XLSX.WorkSheet, range: string) {
  styleRange(sheet, range, bodyStyle);
}

function resultLabel(value: number) {
  if (value > 0) return "Thắng";
  if (value < 0) return "Thua";
  return "Hòa vốn";
}

function tradeNet(trade: ExcelTrade) {
  return safeNumber(trade.pnl) - safeNumber(trade.fees) - safeNumber(trade.swap);
}

function buildHistorySheet(trades: ExcelTrade[]) {
  const headers = [
    "STT", "Mã giao dịch", "Mã ngoài", "Mở", "Đóng", "Ngày", "Thứ", "Tháng",
    "Thị trường", "Sản phẩm", "Nguồn dữ liệu", "Tài khoản", "Lệnh", "Phiên", "Setup",
    "Khung thời gian", "Khối lượng", "Giá mở lệnh", "Cắt lỗ", "Chốt lời", "Giá đóng lệnh",
    "Biến động theo hướng", "Biến động (%)", "Rủi ro (VNĐ)", "Lãi/Lỗ trước phí (VNĐ)",
    "Phí qua đêm (VNĐ)", "Hoa hồng/Phí (VNĐ)", "Lãi/Lỗ sau phí (VNĐ)", "Kết quả",
    "Kết quả (R)", "Pip/Point", "Kỷ luật (%)", "Tâm lý", "Thời lượng (phút)",
    "Thời lượng (giây)", "R:R kế hoạch", "Ghi chú",
  ];

  const rows: Array<Array<string | number | Date | XLSX.CellObject>> = [[], [], [], [], headers];
  trades.forEach((trade, index) => {
    const row = HISTORY_START_ROW + index;
    const entry = safeNumber(trade.entryPrice);
    const exit = safeNumber(trade.exitPrice);
    const change = entry && exit ? (trade.side === "Buy" ? exit - entry : entry - exit) : 0;
    const changePct = entry ? change / entry : 0;
    const pnl = safeNumber(trade.pnl);
    const fees = safeNumber(trade.fees);
    const swap = safeNumber(trade.swap);
    const net = pnl - fees - swap;
    const rMultiple = safeNumber(trade.risk) ? net / safeNumber(trade.risk) : 0;
    const stopLoss = safeNumber(trade.stopLoss);
    const takeProfit = safeNumber(trade.takeProfit);
    const plannedRr = entry && stopLoss && takeProfit ? Math.abs((takeProfit - entry) / (entry - stopLoss)) : 0;

    const pnlStyle: CellStyle = {
      ...formulaStyle,
      font: { name: "Aptos", sz: 10, bold: true, color: { rgb: net > 0 ? COLORS.green : net < 0 ? COLORS.red : COLORS.muted } },
    };
    const resultStyle: CellStyle = {
      ...bodyStyle,
      fill: { fgColor: { rgb: net > 0 ? COLORS.greenSoft : net < 0 ? COLORS.redSoft : COLORS.graySoft } },
      font: { name: "Aptos", sz: 10, bold: true, color: { rgb: net > 0 ? COLORS.green : net < 0 ? COLORS.red : COLORS.muted } },
      alignment: { vertical: "center", horizontal: "center" },
    };

    rows.push([
      index + 1,
      trade.id,
      trade.externalId || "",
      toExcelDate(trade.openedAt || trade.date, !trade.openedAt),
      toExcelDate(trade.closedAt),
      toExcelDate(trade.date, true),
      weekday(trade.date),
      monthKey(trade.date),
      trade.market || "Hàng hóa",
      trade.symbol,
      trade.source || "Thủ công",
      trade.accountId || "",
      trade.side === "Buy" ? "BUY" : "SELL",
      trade.session,
      trade.setup,
      trade.timeframe,
      safeNumber(trade.quantity),
      entry,
      stopLoss || "",
      takeProfit || "",
      exit,
      formulaCell(`=IFERROR(IF(M${row}=\"BUY\",U${row}-R${row},R${row}-U${row}),0)`, change, NUMBER_FORMAT),
      formulaCell(`=IFERROR(V${row}/R${row},0)`, changePct, PERCENT_FORMAT),
      safeNumber(trade.risk),
      pnl,
      swap,
      fees,
      formulaCell(`=Y${row}-Z${row}-AA${row}`, net, MONEY_FORMAT, pnlStyle),
      formulaCell(`=IF(AB${row}>0,\"Thắng\",IF(AB${row}<0,\"Thua\",\"Hòa vốn\"))`, resultLabel(net), undefined, resultStyle),
      formulaCell(`=IFERROR(AB${row}/X${row},0)`, rMultiple, R_FORMAT, pnlStyle),
      trade.pips === undefined ? "" : safeNumber(trade.pips),
      safeNumber(trade.discipline) / 100,
      trade.psychology,
      safeNumber(trade.durationMin),
      formulaCell(`=AH${row}*60`, safeNumber(trade.durationMin) * 60, INTEGER_FORMAT),
      formulaCell(`=IFERROR(ABS((T${row}-R${row})/(R${row}-S${row})),0)`, plannedRr, R_FORMAT),
      trade.note,
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  setTitle(
    sheet,
    "A1:AK2",
    "TRADING PLAN PRO — LỊCH SỬ GIAO DỊCH CHI TIẾT",
    "Bảng dữ liệu mở rộng theo file mẫu: giữ các trường lệnh, giá, phí, lợi nhuận và bổ sung phân loại, rủi ro, kỷ luật, tâm lý cùng các chỉ số dẫn xuất.",
    "AK",
  );
  applyHeader(sheet, "A5:AK5");
  if (trades.length) applyBody(sheet, `A6:AK${trades.length + 5}`);

  for (let row = HISTORY_START_ROW; row < HISTORY_START_ROW + trades.length; row += 1) {
    ["D", "E"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = DATETIME_FORMAT; });
    if (sheet[`F${row}`]) sheet[`F${row}`].z = DATE_FORMAT;
    ["Q", "R", "S", "T", "U", "V", "AE"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = NUMBER_FORMAT; });
    ["X", "Y", "Z", "AA", "AB"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = MONEY_FORMAT; });
    ["W", "AF"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = PERCENT_FORMAT; });
    ["AD", "AJ"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = R_FORMAT; });
    ["AH", "AI"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = INTEGER_FORMAT; });
  }

  sheet["!autofilter"] = { ref: `A5:AK${Math.max(5, trades.length + 5)}` };
  sheet["!cols"] = [
    6, 18, 22, 19, 19, 12, 12, 10, 14, 15, 18, 16, 9, 12, 24, 15, 12, 14, 14,
    14, 14, 18, 14, 16, 20, 18, 20, 20, 12, 13, 12, 13, 16, 18, 18, 14, 48,
  ].map((wch) => ({ wch }));
  sheet["!rows"] = [
    ...(sheet["!rows"] || []),
    { hpt: 8 },
    { hpt: 28 },
    ...trades.map(() => ({ hpt: 22 })),
  ];
  return sheet;
}

function buildReferenceSheet(trades: ExcelTrade[]) {
  const headers = [
    "Mã số giao dịch", "Mở", "Lệnh", "Khối lượng", "Mã", "Giá mở lệnh", "Cắt Lỗ",
    "Chốt Lời", "Đóng", "Giá đóng lệnh", "Phí qua đêm", "Tiền hoa hồng", "Lợi nhuận",
    "Píp", "Thời lượng giao dịch tính bằng giây",
  ];
  const rows = trades.map((trade) => [
    trade.externalId || trade.id,
    toExcelDate(trade.openedAt || trade.date, !trade.openedAt),
    trade.side === "Buy" ? "buy" : "sell",
    safeNumber(trade.quantity),
    trade.symbol,
    safeNumber(trade.entryPrice),
    trade.stopLoss === undefined ? "" : safeNumber(trade.stopLoss),
    trade.takeProfit === undefined ? "" : safeNumber(trade.takeProfit),
    toExcelDate(trade.closedAt),
    safeNumber(trade.exitPrice),
    safeNumber(trade.swap),
    safeNumber(trade.fees),
    safeNumber(trade.pnl),
    trade.pips === undefined ? "" : safeNumber(trade.pips),
    safeNumber(trade.durationMin) * 60,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([[], [], [], [], headers, ...rows], { cellDates: true });
  setTitle(
    sheet,
    "A1:O2",
    "BẢNG GIAO DỊCH THEO MẪU GỐC",
    "Giữ đúng 15 trường và thứ tự cột của file Excel bạn cung cấp. Trường chưa được website ghi nhận (SL, TP, swap, pip hoặc thời điểm đóng) sẽ để trống thay vì tự suy đoán.",
    "O",
  );
  applyHeader(sheet, "A5:O5");
  if (rows.length) applyBody(sheet, `A6:O${rows.length + 5}`);
  for (let row = 6; row <= rows.length + 5; row += 1) {
    ["B", "I"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = DATETIME_FORMAT; });
    ["D", "F", "G", "H", "J", "K", "L", "M", "N"].forEach((column) => { if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = NUMBER_FORMAT; });
    if (sheet[`O${row}`]) sheet[`O${row}`].z = INTEGER_FORMAT;
  }
  sheet["!autofilter"] = { ref: `A5:O${Math.max(5, rows.length + 5)}` };
  sheet["!cols"] = [18, 20, 10, 12, 15, 15, 15, 15, 20, 16, 16, 18, 16, 12, 30].map((wch) => ({ wch }));
  return sheet;
}

function buildSummarySheet(trades: ExcelTrade[], exportedAt: Date) {
  const wins = trades.filter((trade) => tradeNet(trade) > 0).length;
  const losses = trades.filter((trade) => tradeNet(trade) < 0).length;
  const breakeven = trades.length - wins - losses;
  const totalRisk = trades.reduce((sum, trade) => sum + safeNumber(trade.risk), 0);
  const grossProfit = trades.reduce((sum, trade) => sum + Math.max(safeNumber(trade.pnl), 0), 0);
  const grossLoss = Math.abs(trades.reduce((sum, trade) => sum + Math.min(safeNumber(trade.pnl), 0), 0));
  const totalPnl = trades.reduce((sum, trade) => sum + safeNumber(trade.pnl), 0);
  const totalFees = trades.reduce((sum, trade) => sum + safeNumber(trade.fees) + safeNumber(trade.swap), 0);
  const totalNet = trades.reduce((sum, trade) => sum + tradeNet(trade), 0);
  const averageR = trades.length
    ? trades.reduce((sum, trade) => sum + (safeNumber(trade.risk) ? tradeNet(trade) / safeNumber(trade.risk) : 0), 0) / trades.length
    : 0;
  const averageDiscipline = trades.length ? trades.reduce((sum, trade) => sum + safeNumber(trade.discipline), 0) / trades.length / 100 : 0;
  const averageDuration = trades.length ? trades.reduce((sum, trade) => sum + safeNumber(trade.durationMin), 0) / trades.length : 0;
  const netValues = trades.map(tradeNet);

  const history = {
    count: `'Lịch sử chi tiết'!$B$${HISTORY_START_ROW}:$B$${HISTORY_MAX_ROW}`,
    result: `'Lịch sử chi tiết'!$AC$${HISTORY_START_ROW}:$AC$${HISTORY_MAX_ROW}`,
    risk: `'Lịch sử chi tiết'!$X$${HISTORY_START_ROW}:$X$${HISTORY_MAX_ROW}`,
    pnl: `'Lịch sử chi tiết'!$Y$${HISTORY_START_ROW}:$Y$${HISTORY_MAX_ROW}`,
    swap: `'Lịch sử chi tiết'!$Z$${HISTORY_START_ROW}:$Z$${HISTORY_MAX_ROW}`,
    fees: `'Lịch sử chi tiết'!$AA$${HISTORY_START_ROW}:$AA$${HISTORY_MAX_ROW}`,
    net: `'Lịch sử chi tiết'!$AB$${HISTORY_START_ROW}:$AB$${HISTORY_MAX_ROW}`,
    r: `'Lịch sử chi tiết'!$AD$${HISTORY_START_ROW}:$AD$${HISTORY_MAX_ROW}`,
    discipline: `'Lịch sử chi tiết'!$AF$${HISTORY_START_ROW}:$AF$${HISTORY_MAX_ROW}`,
    duration: `'Lịch sử chi tiết'!$AH$${HISTORY_START_ROW}:$AH$${HISTORY_MAX_ROW}`,
    month: `'Lịch sử chi tiết'!$H$${HISTORY_START_ROW}:$H$${HISTORY_MAX_ROW}`,
  };

  const metrics: Array<[string, XLSX.CellObject, string]> = [
    ["Tổng số giao dịch", formulaCell(`=COUNTA(${history.count})`, trades.length, INTEGER_FORMAT), "Số lệnh trong phạm vi xuất"],
    ["Lệnh thắng", formulaCell(`=COUNTIF(${history.result},\"Thắng\")`, wins, INTEGER_FORMAT), "Lãi sau phí lớn hơn 0"],
    ["Lệnh thua", formulaCell(`=COUNTIF(${history.result},\"Thua\")`, losses, INTEGER_FORMAT), "Lãi sau phí nhỏ hơn 0"],
    ["Hòa vốn", formulaCell(`=COUNTIF(${history.result},\"Hòa vốn\")`, breakeven, INTEGER_FORMAT), "Lãi sau phí bằng 0"],
    ["Tỷ lệ thắng", formulaCell("=IFERROR(B7/B6,0)", trades.length ? wins / trades.length : 0, PERCENT_FORMAT), "Lệnh thắng / Tổng giao dịch"],
    ["Tổng rủi ro", formulaCell(`=SUM(${history.risk})`, totalRisk, MONEY_FORMAT), "Tổng rủi ro dự kiến"],
    ["Tổng lãi gộp", formulaCell(`=SUMIF(${history.pnl},\">0\",${history.pnl})`, grossProfit, MONEY_FORMAT), "Tổng P&L dương trước phí"],
    ["Tổng lỗ gộp", formulaCell(`=ABS(SUMIF(${history.pnl},\"<0\",${history.pnl}))`, grossLoss, MONEY_FORMAT), "Giá trị tuyệt đối P&L âm"],
    ["P&L trước phí", formulaCell(`=SUM(${history.pnl})`, totalPnl, MONEY_FORMAT), "Tổng lợi nhuận trước swap và phí"],
    ["Tổng swap + phí", formulaCell(`=SUM(${history.swap})+SUM(${history.fees})`, totalFees, MONEY_FORMAT), "Phí qua đêm và hoa hồng"],
    ["P&L sau phí", formulaCell(`=SUM(${history.net})`, totalNet, MONEY_FORMAT), "Kết quả ròng cuối cùng"],
    ["P&L trung bình/lệnh", formulaCell(`=IFERROR(AVERAGE(${history.net}),0)`, trades.length ? totalNet / trades.length : 0, MONEY_FORMAT), "Kết quả ròng bình quân"],
    ["R trung bình/lệnh", formulaCell(`=IFERROR(AVERAGE(${history.r}),0)`, averageR, R_FORMAT), "Kỳ vọng theo đơn vị rủi ro"],
    ["Profit factor", formulaCell("=IFERROR(B12/B13,0)", grossLoss ? grossProfit / grossLoss : 0, "0.00x"), "Tổng lãi gộp / Tổng lỗ gộp"],
    ["Kỷ luật trung bình", formulaCell(`=IFERROR(AVERAGE(${history.discipline}),0)`, averageDiscipline, PERCENT_FORMAT), "Điểm tuân thủ kế hoạch"],
    ["Thời lượng trung bình", formulaCell(`=IFERROR(AVERAGE(${history.duration}),0)`, averageDuration, INTEGER_FORMAT), "Phút giữ lệnh trung bình"],
    ["Lệnh tốt nhất", formulaCell(`=IFERROR(MAX(${history.net}),0)`, netValues.length ? Math.max(...netValues) : 0, MONEY_FORMAT), "P&L sau phí cao nhất"],
    ["Lệnh tệ nhất", formulaCell(`=IFERROR(MIN(${history.net}),0)`, netValues.length ? Math.min(...netValues) : 0, MONEY_FORMAT), "P&L sau phí thấp nhất"],
  ];

  const months = [...new Set(trades.map((trade) => monthKey(trade.date)))].sort();
  const monthRows = months.map((month, index) => {
    const monthTrades = trades.filter((trade) => monthKey(trade.date) === month);
    const monthWins = monthTrades.filter((trade) => tradeNet(trade) > 0).length;
    const monthLosses = monthTrades.filter((trade) => tradeNet(trade) < 0).length;
    const monthNet = monthTrades.reduce((sum, trade) => sum + tradeNet(trade), 0);
    const monthR = monthTrades.reduce((sum, trade) => sum + (safeNumber(trade.risk) ? tradeNet(trade) / safeNumber(trade.risk) : 0), 0) / Math.max(monthTrades.length, 1);
    const criterion = excelText(month);
    return [
      month,
      formulaCell(`=COUNTIF(${history.month},\"${criterion}\")`, monthTrades.length, INTEGER_FORMAT),
      formulaCell(`=COUNTIFS(${history.month},\"${criterion}\",${history.result},\"Thắng\")`, monthWins, INTEGER_FORMAT),
      formulaCell(`=COUNTIFS(${history.month},\"${criterion}\",${history.result},\"Thua\")`, monthLosses, INTEGER_FORMAT),
      formulaCell(`=IFERROR(G${index + 6}/F${index + 6},0)`, monthTrades.length ? monthWins / monthTrades.length : 0, PERCENT_FORMAT),
      formulaCell(`=SUMIF(${history.month},\"${criterion}\",${history.net})`, monthNet, MONEY_FORMAT),
      formulaCell(`=IFERROR(AVERAGEIF(${history.month},\"${criterion}\",${history.r}),0)`, monthR, R_FORMAT),
    ];
  });

  const rows: Array<Array<string | number | Date | XLSX.CellObject>> = [
    [], [], [], [],
    ["Chỉ số", "Giá trị", "Cách đọc", "", "Tháng", "Số lệnh", "Thắng", "Thua", "Tỷ lệ thắng", "P&L sau phí", "R trung bình"],
    ...metrics.map((metric) => [metric[0], metric[1], metric[2]]),
  ];
  monthRows.forEach((monthRow, index) => {
    const targetRow = 6 + index;
    const target = rows[targetRow - 1] || [];
    while (target.length < 4) target.push("");
    target.splice(4, 7, ...monthRow);
    rows[targetRow - 1] = target;
  });
  rows.push([], ["Lưu ý", "Dữ liệu được xuất từ Trading Plan Pro. Các chỉ số là công cụ hỗ trợ đánh giá, không phải khuyến nghị đầu tư."]);

  const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  setTitle(
    sheet,
    "A1:K2",
    "TRADING PLAN PRO — TỔNG QUAN HIỆU SUẤT",
    `Xuất lúc ${exportedAt.toLocaleString("vi-VN")} · ${trades.length} giao dịch đang hiển thị trên trang Nhật ký. Các chỉ số được liên kết bằng công thức với sheet Lịch sử chi tiết.`,
    "K",
  );
  applyHeader(sheet, "A5:C5");
  applyHeader(sheet, "E5:K5");
  if (metrics.length) applyBody(sheet, `A6:C${metrics.length + 5}`);
  if (monthRows.length) applyBody(sheet, `E6:K${monthRows.length + 5}`);
  for (let row = 6; row <= metrics.length + 5; row += 1) {
    if (sheet[`A${row}`]) sheet[`A${row}`].s = { ...bodyStyle, font: { name: "Aptos", sz: 10, bold: true, color: { rgb: COLORS.text } } };
    if (sheet[`B${row}`]) {
      const value = safeNumber(sheet[`B${row}`].v);
      sheet[`B${row}`].s = {
        ...(sheet[`B${row}`].s || formulaStyle),
        fill: { fgColor: { rgb: value < 0 ? COLORS.redSoft : COLORS.blueSoft } },
        font: { name: "Aptos", sz: 10, bold: true, color: { rgb: value < 0 ? COLORS.red : COLORS.blue } },
      };
    }
  }
  sheet["!cols"] = [24, 18, 44, 3, 12, 11, 11, 11, 14, 18, 14].map((wch) => ({ wch }));
  return sheet;
}

type Breakdown = { title: string; column: string; values: string[] };

function buildAnalysisSheet(trades: ExcelTrade[]) {
  const breakdowns: Breakdown[] = [
    { title: "Theo tháng", column: "H", values: [...new Set(trades.map((trade) => monthKey(trade.date)))].sort() },
    { title: "Theo thị trường", column: "I", values: [...new Set(trades.map((trade) => trade.market || "Hàng hóa"))].sort() },
    { title: "Theo sản phẩm", column: "J", values: [...new Set(trades.map((trade) => trade.symbol))].sort() },
    { title: "Theo setup", column: "O", values: [...new Set(trades.map((trade) => trade.setup))].sort() },
    { title: "Theo phiên", column: "N", values: [...new Set(trades.map((trade) => trade.session))].sort() },
    { title: "Theo khung thời gian", column: "P", values: [...new Set(trades.map((trade) => trade.timeframe))].sort() },
    { title: "Theo tâm lý", column: "AG", values: [...new Set(trades.map((trade) => trade.psychology))].sort() },
  ];
  const rows: Array<Array<string | number | XLSX.CellObject>> = [[], [], [], []];
  const sectionRanges: string[] = [];
  const headerRows: number[] = [];
  const bodyRanges: string[] = [];
  const historyRange = (column: string) => `'Lịch sử chi tiết'!$${column}$${HISTORY_START_ROW}:$${column}$${HISTORY_MAX_ROW}`;
  const resultRange = historyRange("AC");
  const pnlRange = historyRange("Y");
  const netRange = historyRange("AB");
  const rRange = historyRange("AD");
  const disciplineRange = historyRange("AF");
  const durationRange = historyRange("AH");

  let currentRow = 5;
  for (const breakdown of breakdowns) {
    const sectionRow = currentRow;
    rows[sectionRow - 1] = [breakdown.title];
    rows[sectionRow] = [
      "Nhóm", "Số lệnh", "Thắng", "Thua", "Tỷ lệ thắng", "Lãi gộp", "Lỗ gộp",
      "P&L sau phí", "R trung bình", "Profit factor", "Kỷ luật TB", "Thời lượng TB (phút)",
    ];
    sectionRanges.push(`A${sectionRow}:L${sectionRow}`);
    headerRows.push(sectionRow + 1);
    const bodyStart = sectionRow + 2;

    for (const [index, value] of breakdown.values.entries()) {
      const rowNumber = bodyStart + index;
      const matching = trades.filter((trade) => {
        if (breakdown.column === "H") return monthKey(trade.date) === value;
        if (breakdown.column === "I") return (trade.market || "Hàng hóa") === value;
        if (breakdown.column === "J") return trade.symbol === value;
        if (breakdown.column === "O") return trade.setup === value;
        if (breakdown.column === "N") return trade.session === value;
        if (breakdown.column === "P") return trade.timeframe === value;
        return trade.psychology === value;
      });
      const wins = matching.filter((trade) => tradeNet(trade) > 0).length;
      const losses = matching.filter((trade) => tradeNet(trade) < 0).length;
      const grossProfit = matching.reduce((sum, trade) => sum + Math.max(safeNumber(trade.pnl), 0), 0);
      const grossLoss = Math.abs(matching.reduce((sum, trade) => sum + Math.min(safeNumber(trade.pnl), 0), 0));
      const net = matching.reduce((sum, trade) => sum + tradeNet(trade), 0);
      const averageR = matching.reduce((sum, trade) => sum + (safeNumber(trade.risk) ? tradeNet(trade) / safeNumber(trade.risk) : 0), 0) / Math.max(matching.length, 1);
      const averageDiscipline = matching.reduce((sum, trade) => sum + safeNumber(trade.discipline) / 100, 0) / Math.max(matching.length, 1);
      const averageDuration = matching.reduce((sum, trade) => sum + safeNumber(trade.durationMin), 0) / Math.max(matching.length, 1);
      const criterion = excelText(value);
      const dimensionRange = historyRange(breakdown.column);
      rows[rowNumber - 1] = [
        value,
        formulaCell(`=COUNTIF(${dimensionRange},\"${criterion}\")`, matching.length, INTEGER_FORMAT),
        formulaCell(`=COUNTIFS(${dimensionRange},\"${criterion}\",${resultRange},\"Thắng\")`, wins, INTEGER_FORMAT),
        formulaCell(`=COUNTIFS(${dimensionRange},\"${criterion}\",${resultRange},\"Thua\")`, losses, INTEGER_FORMAT),
        formulaCell(`=IFERROR(C${rowNumber}/B${rowNumber},0)`, matching.length ? wins / matching.length : 0, PERCENT_FORMAT),
        formulaCell(`=SUMIFS(${pnlRange},${dimensionRange},\"${criterion}\",${pnlRange},\">0\")`, grossProfit, MONEY_FORMAT),
        formulaCell(`=ABS(SUMIFS(${pnlRange},${dimensionRange},\"${criterion}\",${pnlRange},\"<0\"))`, grossLoss, MONEY_FORMAT),
        formulaCell(`=SUMIF(${dimensionRange},\"${criterion}\",${netRange})`, net, MONEY_FORMAT),
        formulaCell(`=IFERROR(AVERAGEIF(${dimensionRange},\"${criterion}\",${rRange}),0)`, averageR, R_FORMAT),
        formulaCell(`=IFERROR(F${rowNumber}/G${rowNumber},0)`, grossLoss ? grossProfit / grossLoss : 0, "0.00x"),
        formulaCell(`=IFERROR(AVERAGEIF(${dimensionRange},\"${criterion}\",${disciplineRange}),0)`, averageDiscipline, PERCENT_FORMAT),
        formulaCell(`=IFERROR(AVERAGEIF(${dimensionRange},\"${criterion}\",${durationRange}),0)`, averageDuration, INTEGER_FORMAT),
      ];
    }
    if (breakdown.values.length) bodyRanges.push(`A${bodyStart}:L${bodyStart + breakdown.values.length - 1}`);
    currentRow = bodyStart + Math.max(breakdown.values.length, 1) + 2;
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  setTitle(
    sheet,
    "A1:L2",
    "TRADING PLAN PRO — PHÂN TÍCH ĐA CHIỀU",
    "So sánh hiệu suất theo tháng, thị trường, sản phẩm, setup, phiên, khung thời gian và trạng thái tâm lý. Tất cả số liệu được liên kết với Lịch sử chi tiết.",
    "L",
  );
  sectionRanges.forEach((range) => {
    styleRange(sheet, range, sectionStyle);
    sheet["!merges"] = [...(sheet["!merges"] || []), XLSX.utils.decode_range(range)];
  });
  headerRows.forEach((row) => applyHeader(sheet, `A${row}:L${row}`));
  bodyRanges.forEach((range) => applyBody(sheet, range));
  sheet["!cols"] = [28, 11, 11, 11, 14, 17, 17, 19, 14, 14, 14, 21].map((wch) => ({ wch }));
  return sheet;
}

function buildDictionarySheet() {
  const fields = [
    ["Định danh", "Mã giao dịch", "Lịch sử chi tiết!B", "Mã nội bộ duy nhất của journal", "Website", "Text"],
    ["Định danh", "Mã ngoài", "Lịch sử chi tiết!C", "Ticket/deal/order ID từ broker hoặc nguồn nhập", "Nguồn tích hợp", "Text"],
    ["Thời gian", "Mở / Đóng", "Lịch sử chi tiết!D:E", "Thời điểm mở và đóng nếu nguồn có cung cấp", "Nguồn tích hợp", "yyyy-mm-dd hh:mm:ss"],
    ["Thời gian", "Ngày / Thứ / Tháng", "Lịch sử chi tiết!F:H", "Mốc ngày và nhóm thời gian phục vụ phân tích", "Website + công thức", "Date / Text"],
    ["Phân loại", "Thị trường / Sản phẩm", "Lịch sử chi tiết!I:J", "Nhóm tài sản và mã giao dịch", "Website", "Text"],
    ["Phân loại", "Nguồn / Tài khoản", "Lịch sử chi tiết!K:L", "Nguồn dữ liệu và tài khoản giao dịch", "Website", "Text"],
    ["Chiến lược", "Lệnh / Phiên / Setup / Khung", "Lịch sử chi tiết!M:P", "Ngữ cảnh thực thi và cấu trúc chiến lược", "Website", "Text"],
    ["Khớp lệnh", "Khối lượng / Giá mở / Giá đóng", "Lịch sử chi tiết!Q:R,U", "Quy mô và giá thực tế", "Website", "Number"],
    ["Kế hoạch", "Cắt lỗ / Chốt lời", "Lịch sử chi tiết!S:T", "Mức bảo vệ và mục tiêu; để trống nếu chưa được ghi nhận", "Nguồn tích hợp", "Number"],
    ["Giá", "Biến động theo hướng / %", "Lịch sử chi tiết!V:W", "BUY: giá đóng - giá mở; SELL: giá mở - giá đóng", "Công thức", "Number / %"],
    ["Rủi ro", "Rủi ro", "Lịch sử chi tiết!X", "Số tiền rủi ro dự kiến quy đổi VNĐ", "Website", "VNĐ"],
    ["Kết quả", "P&L trước phí", "Lịch sử chi tiết!Y", "Lợi nhuận/lỗ thực tế trước swap và phí", "Website", "VNĐ"],
    ["Chi phí", "Swap / Hoa hồng", "Lịch sử chi tiết!Z:AA", "Phí qua đêm và phí giao dịch", "Nguồn tích hợp / Website", "VNĐ"],
    ["Kết quả", "P&L sau phí", "Lịch sử chi tiết!AB", "P&L trước phí - swap - hoa hồng", "Công thức", "VNĐ"],
    ["Kết quả", "Kết quả / R", "Lịch sử chi tiết!AC:AD", "Phân loại thắng-thua-hòa và kết quả trên một đơn vị rủi ro", "Công thức", "Text / R"],
    ["Kết quả", "Pip/Point", "Lịch sử chi tiết!AE", "Giá trị pip/point nếu nguồn có cung cấp", "Nguồn tích hợp", "Number"],
    ["Quy trình", "Kỷ luật / Tâm lý", "Lịch sử chi tiết!AF:AG", "Điểm tuân thủ kế hoạch và trạng thái tâm lý", "Website", "% / Text"],
    ["Thời gian", "Thời lượng phút / giây", "Lịch sử chi tiết!AH:AI", "Thời lượng giữ lệnh; giây được tính từ phút", "Website + công thức", "Number"],
    ["Kế hoạch", "R:R kế hoạch", "Lịch sử chi tiết!AJ", "|TP - Entry| / |Entry - SL| khi đủ dữ liệu", "Công thức", "R"],
    ["Ghi chú", "Ghi chú", "Lịch sử chi tiết!AK", "Nhận xét và bài học sau giao dịch", "Website", "Text"],
  ];
  const rows = [[], [], [], [], ["Nhóm", "Trường", "Vị trí", "Diễn giải", "Nguồn", "Định dạng"], ...fields];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  setTitle(
    sheet,
    "A1:F2",
    "DANH MỤC TRƯỜNG & CÔNG THỨC",
    "Dùng sheet này để hiểu nguồn dữ liệu, ý nghĩa và cách tính các trường trong báo cáo.",
    "F",
  );
  applyHeader(sheet, "A5:F5");
  applyBody(sheet, `A6:F${fields.length + 5}`);
  sheet["!cols"] = [18, 30, 28, 62, 28, 22].map((wch) => ({ wch }));
  return sheet;
}

export function buildTradeWorkbook(trades: ExcelTrade[], exportedAt = new Date()) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "Trading Plan Pro — Báo cáo giao dịch chi tiết",
    Subject: "Nhật ký giao dịch và phân tích hiệu suất",
    Author: "Trading Plan Pro",
    Company: "Tuan Trader",
    CreatedDate: exportedAt,
  };
  workbook.CalcPr = { calcMode: "auto", fullCalcOnLoad: true, forceFullCalc: true };

  XLSX.utils.book_append_sheet(workbook, buildSummarySheet(trades, exportedAt), "Tổng quan");
  XLSX.utils.book_append_sheet(workbook, buildAnalysisSheet(trades), "Phân tích");
  XLSX.utils.book_append_sheet(workbook, buildHistorySheet(trades), "Lịch sử chi tiết");
  XLSX.utils.book_append_sheet(workbook, buildReferenceSheet(trades), "Theo mẫu gốc");
  XLSX.utils.book_append_sheet(workbook, buildDictionarySheet(), "Danh mục trường");
  return workbook;
}

export function downloadTradeWorkbook(trades: ExcelTrade[], exportedAt = new Date()) {
  const workbook = buildTradeWorkbook(trades, exportedAt);
  XLSX.writeFile(workbook, `trading-plan-pro-bao-cao-giao-dich-${exportedAt.toISOString().slice(0, 10)}.xlsx`, {
    bookType: "xlsx",
    compression: true,
    cellStyles: true,
  });
}
