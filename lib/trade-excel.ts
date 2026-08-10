import * as XLSX from "xlsx";

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
};

const HISTORY_HEADERS = [
  "STT", "Mã giao dịch", "Ngày", "Thị trường", "Sản phẩm", "Nguồn dữ liệu",
  "Tài khoản", "Hướng", "Phiên", "Setup", "Khung thời gian", "Rủi ro (VNĐ)",
  "Lãi / Lỗ (VNĐ)", "Kết quả (R)", "Phí (VNĐ)", "Khối lượng", "Giá vào", "Giá ra",
  "Kỷ luật (%)", "Tâm lý", "Thời gian giữ (phút)", "Ghi chú", "Mã ngoài",
];

function validDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date;
}

export function buildTradeWorkbook(trades: ExcelTrade[], exportedAt = new Date()) {
  const wins = trades.filter((trade) => trade.pnl > 0).length;
  const losses = trades.filter((trade) => trade.pnl < 0).length;
  const breakeven = trades.length - wins - losses;
  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalRisk = trades.reduce((sum, trade) => sum + trade.risk, 0);
  const totalFees = trades.reduce((sum, trade) => sum + Number(trade.fees || 0), 0);

  const summary = XLSX.utils.aoa_to_sheet([
    ["TRADING PLAN PRO — BÁO CÁO LỊCH SỬ GIAO DỊCH"],
    ["Thời điểm xuất", exportedAt],
    ["Số giao dịch", trades.length],
    ["Lệnh thắng", wins],
    ["Lệnh thua", losses],
    ["Hòa vốn", breakeven],
    ["Tỷ lệ thắng", trades.length ? wins / trades.length : 0],
    ["Tổng rủi ro (VNĐ)", totalRisk],
    ["Tổng phí (VNĐ)", totalFees],
    ["Lãi / Lỗ ròng (VNĐ)", totalPnl],
    [],
    ["Lưu ý", "Dữ liệu được xuất từ Trading Plan Pro và không phải khuyến nghị đầu tư."],
  ]);
  summary["!cols"] = [{ wch: 24 }, { wch: 54 }];
  if (summary.B2) summary.B2.z = "yyyy-mm-dd hh:mm";
  if (summary.B7) summary.B7.z = "0.00%";
  ["B8", "B9", "B10"].forEach((cell) => { if (summary[cell]) summary[cell].z = "#,##0"; });

  const historyRows = trades.map((trade, index) => [
    index + 1,
    trade.id,
    validDate(trade.date),
    trade.market || "Hàng hóa",
    trade.symbol,
    trade.source || "Thủ công",
    trade.accountId || "",
    trade.side,
    trade.session,
    trade.setup,
    trade.timeframe,
    Number(trade.risk || 0),
    Number(trade.pnl || 0),
    trade.risk ? trade.pnl / trade.risk : 0,
    Number(trade.fees || 0),
    Number(trade.quantity || 0),
    Number(trade.entryPrice || 0),
    Number(trade.exitPrice || 0),
    Number(trade.discipline || 0) / 100,
    trade.psychology,
    Number(trade.durationMin || 0),
    trade.note,
    trade.externalId || "",
  ]);
  const history = XLSX.utils.aoa_to_sheet([HISTORY_HEADERS, ...historyRows], { cellDates: true });
  history["!autofilter"] = { ref: `A1:W${Math.max(1, historyRows.length + 1)}` };
  history["!cols"] = [
    6, 18, 12, 14, 15, 18, 16, 9, 12, 24, 14, 16, 17, 13, 14, 12, 13, 13, 13, 15, 21, 42, 22,
  ].map((wch) => ({ wch }));
  for (let row = 2; row <= historyRows.length + 1; row += 1) {
    if (history[`C${row}`]?.t === "d") history[`C${row}`].z = "yyyy-mm-dd";
    ["L", "M", "O"].forEach((column) => { if (history[`${column}${row}`]) history[`${column}${row}`].z = "#,##0"; });
    if (history[`N${row}`]) history[`N${row}`].z = "0.00\"R\"";
    if (history[`S${row}`]) history[`S${row}`].z = "0%";
  }

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "Trading Plan Pro — Lịch sử giao dịch",
    Subject: "Nhật ký giao dịch",
    Author: "Trading Plan Pro",
    CreatedDate: exportedAt,
  };
  XLSX.utils.book_append_sheet(workbook, summary, "Tổng quan");
  XLSX.utils.book_append_sheet(workbook, history, "Lịch sử giao dịch");
  return workbook;
}

export function downloadTradeWorkbook(trades: ExcelTrade[], exportedAt = new Date()) {
  const workbook = buildTradeWorkbook(trades, exportedAt);
  XLSX.writeFile(workbook, `trading-plan-pro-lich-su-${exportedAt.toISOString().slice(0, 10)}.xlsx`, {
    bookType: "xlsx",
    compression: true,
  });
}
