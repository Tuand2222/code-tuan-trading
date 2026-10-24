import { redactSecrets } from "./unified-ingestion";
import { positionCycles } from "./position-cycles";
import XLSX from "xlsx-js-style";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import {
  analyzeRiskTrades,
  riskDesk,
  netPnl,
  DEFAULT_RISK,
  type RiskSettings,
  type RiskTrade,
} from "./risk-analytics";
import type { ExcelTrade } from "./trade-excel";
export interface AuditReceipt {
  batchId?: string;
  source?: string;
  scanned?: number;
  imported?: number;
  updated?: number;
  duplicates?: number;
  errors?: string[];
  hashes?: string[];
  decisions?: unknown[];
}
export type ReportTrade = ExcelTrade &
  RiskTrade & {
    dedupHash?: string | null;
    semanticHash?: string | null;
    recordKind?: string;
    rawPayloadJson?: string | null;
    mae?: number | null;
    mfe?: number | null;
  };
export const GOVERNANCE_SHEETS = [
  "01_Tong_Quan_Quan_Tri",
  "02_Nhat_Ky_Chuan_Hoa",
  "03_Nhat_Ky_Rui_Ro_Ngay",
  "04_Phan_Tich_Phuong_Phap",
  "05_Doi_Soat_Luu_Vet",
];
function sheet(rows: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = Array.from(
    { length: Math.max(...rows.map((r) => r.length)) },
    (_, i) => ({ wch: i === 0 ? 28 : 19 }),
  );
  ws["!autofilter"] = { ref: ws["!ref"]! };
  ws["!rows"] = [{ hpt: 30 }];
  for (const [key, cell] of Object.entries(ws))
    if (!key.startsWith("!")) {
      const c = cell as XLSX.CellObject;
      const header = XLSX.utils.decode_cell(key).r === 0;
      c.s = {
        font: {
          name: "Be Vietnam Pro",
          sz: 10,
          color: {
            rgb: header
              ? "FFFFFF"
              : typeof c.v === "number" && c.v < 0
                ? "E11D48"
                : "203046",
          },
          bold: header,
        },
        fill: {
          fgColor: {
            rgb: header
              ? "142A30"
              : XLSX.utils.decode_cell(key).r % 2
                ? "F1F5F9"
                : "FFFFFF",
          },
        },
        alignment: { vertical: "center", wrapText: true },
        ...(typeof c.v === "number"
          ? { numFmt: "#,##0.00;[Red](#,##0.00);0" }
          : {}),
      };
    }
  return ws;
}
export function buildGovernanceWorkbook(
  trades: ReportTrade[],
  settings: RiskSettings = DEFAULT_RISK,
  audit: AuditReceipt = {},
  now = new Date(),
) {
  trades = [
    ...trades.filter((t) => !t.id.startsWith("cycle:")),
    ...positionCycles(trades).closed,
  ];
  const desk = riskDesk(trades, settings, now),
    a = analyzeRiskTrades(trades, settings.initialCapital, settings.timezone);
  const wb = XLSX.utils.book_new();
  const summary = [
    ["Chỉ số", "Giá trị", "Cơ sở"],
    ["Thời điểm", now.toISOString(), ""],
    ["Vốn đầu kỳ", settings.initialCapital || null, "Người dùng cấu hình"],
    [
      "Vốn đã thực hiện",
      settings.initialCapital && desk.dataComplete ? desk.balance : null,
      "Vốn đầu kỳ + Net",
    ],
    [
      "Net P&L",
      a.financialComplete ? a.net : null,
      "Gross − phí − swap (chi phí dương)",
    ],
    ["Tỷ lệ thắng (%)", a.winRate, "Lệnh đã đóng"],
    [
      "Profit Factor",
      a.profitFactor,
      a.noLoss ? "Không có lệnh lỗ" : "Net thắng / |Net thua|",
    ],
    ["Expectancy (R)", a.expectancyR, `${a.rN}/${a.n} lệnh có rủi ro ban đầu`],
    ["SQN", a.sqn, "sqrt(min(N,100))*mean(R)/sample SD(R)"],
    [
      "Sharpe theo R/lệnh",
      a.sharpe,
      "Rf=0; không thường niên hóa; không phải Sharpe ngày",
    ],
    ["Sortino theo R/lệnh", a.sortino, "MAR=0; downside RMS trên mọi R"],
    ["Max Drawdown (tiền)", a.maxDD, "Từ đỉnh vốn đã thực hiện"],
    ["Max Drawdown (%)", a.maxDDPercent, "Chia đỉnh vốn tại từng thời điểm"],
    ["Tầng rủi ro", desk.tier, "Vốn đã thực hiện + unrealized nếu được nhập"],
    ["Kỷ luật (%)", a.discipline, "Theo checklist"],
    ["MAE trung bình", a.mae, "Chỉ dữ liệu được ghi nhận"],
    ["MFE trung bình", a.mfe, "Chỉ dữ liệu được ghi nhận"],
    [
      "Phiếu execution chưa ghép",
      a.excludedFills,
      "Không tính là lệnh đã đóng",
    ],
    ["Lãi/lỗ chưa thực hiện", settings.unrealized, "Trống = chưa có dữ liệu"],
    [
      "Thiết lập tài khoản",
      JSON.stringify(settings),
      "Không phải quy định chung của mọi quỹ",
    ],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(summary), GOVERNANCE_SHEETS[0]);
  const ledger = sheet([
    [
      "ID",
      "Ngày",
      "Mở UTC",
      "Đóng UTC",
      "Mã",
      "Chiều",
      "Số lượng",
      "VWAP vào",
      "SL",
      "TP",
      "VWAP ra",
      "Gross",
      "Phí",
      "Swap",
      "Net",
      "Rủi ro ban đầu",
      "R thực nhận",
      "MAE",
      "MFE",
      "Setup",
      "Phiên",
      "Kỷ luật",
      "Tâm lý",
      "Ghi chú",
      "Nguồn",
      "Tài khoản",
      "External ID",
      "Hash",
      "Loại hồ sơ",
    ],
    ...trades.map((t) => [
      t.id,
      t.date,
      t.openedAt ?? "",
      t.closedAt ?? "",
      t.symbol,
      t.side,
      t.quantity ?? null,
      t.entryPrice ?? null,
      t.stopLoss ?? null,
      t.takeProfit ?? null,
      t.exitPrice ?? null,
      t.pnlKnown === false ? null : t.pnl,
      t.feesKnown === false ? null : (t.fees ?? null),
      t.swap ?? 0,
      t.feesKnown === false || t.pnlKnown === false ? null : netPnl(t),
      t.riskKnown === false ? null : t.risk,
      t.risk > 0 &&
      t.riskKnown !== false &&
      t.feesKnown !== false &&
      t.pnlKnown !== false
        ? netPnl(t) / t.risk
        : null,
      t.mae ?? null,
      t.mfe ?? null,
      t.setup,
      t.session,
      t.discipline,
      t.psychology,
      t.note,
      t.source,
      t.accountId,
      t.externalId,
      t.dedupHash ?? "",
      t.recordKind ?? "position",
    ]),
  ]);
  trades.forEach((t, i) => {
    const r = i + 2;
    if (t.feesKnown !== false && t.pnlKnown !== false)
      ledger[`O${r}`] = {
        ...ledger[`O${r}`],
        t: "n",
        v: netPnl(t),
        f: `L${r}-M${r}-N${r}`,
      };
    if (
      t.risk > 0 &&
      t.riskKnown !== false &&
      t.feesKnown !== false &&
      t.pnlKnown !== false
    )
      ledger[`Q${r}`] = {
        ...ledger[`Q${r}`],
        t: "n",
        v: netPnl(t) / t.risk,
        f: `O${r}/P${r}`,
      };
  });
  XLSX.utils.book_append_sheet(wb, ledger, GOVERNANCE_SHEETS[1]);
  let opening = settings.initialCapital,
    hwm = opening;
  const daily: unknown[][] = [
    [
      "Ngày",
      "Số dư đầu ngày",
      "High-water mark",
      "Sàn DD",
      "Net ngày",
      "Ngân sách ngày",
      "Đã dùng (%)",
      "Vi phạm",
    ],
  ];
  for (const day of a.days) {
    hwm = Math.max(hwm, opening);
    const budget = (opening * settings.dailyLossPercent) / 100;
    const floor =
      (settings.floorMode === "trailing" ? hwm : settings.initialCapital) -
      (settings.initialCapital * settings.maxDrawdownPercent) / 100;
    daily.push([
      day.date,
      settings.initialCapital ? opening : null,
      settings.initialCapital ? hwm : null,
      settings.initialCapital ? floor : null,
      day.net,
      budget || null,
      budget ? (100 * Math.max(0, -day.net)) / budget : null,
      budget && -day.net >= budget ? "Vượt hạn mức" : "",
    ]);
    opening += day.net;
    hwm = Math.max(hwm, opening);
  }
  XLSX.utils.book_append_sheet(wb, sheet(daily), GOVERNANCE_SHEETS[2]);
  const matrix: unknown[][] = [
    [
      "Chiều phân tích",
      "Nhóm",
      "Số lệnh",
      "Net",
      "Win Rate (%)",
      "Thời gian TB (phút)",
    ],
  ];
  for (const [label, groups] of [
    ["Setup", a.strategies],
    ["Mã", a.symbols],
    ["Phiên", a.sessions],
    ["Quy tắc", a.compliance],
  ] as const)
    for (const g of groups)
      matrix.push([label, g.label, g.n, g.net, g.winRate, g.meanDuration]);
  XLSX.utils.book_append_sheet(wb, sheet(matrix), GOVERNANCE_SHEETS[3]);
  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      ["Loại", "Nội dung"],
      ["Biên lô", audit.batchId ?? "Báo cáo thủ công"],
      ["Nguồn", audit.source ?? "Workspace"],
      ["Đã quét", audit.scanned ?? trades.length],
      ["Thêm mới", audit.imported ?? null],
      ["Cập nhật dữ kiện", audit.updated ?? null],
      ["Trùng ID bị chặn", audit.duplicates ?? null],
      ...(audit.errors ?? []).map((e) => ["Lỗi", e]),
      ...(audit.hashes ?? []).map((h) => ["SHA-256", h]),
      ...(audit.decisions ?? []).map((d) => ["Đối soát", JSON.stringify(d)]),
      ...trades.map((t) => [
        "Bản ghi",
        JSON.stringify({
          id: t.id,
          source: t.source,
          accountId: t.accountId,
          hash: t.dedupHash,
          kind: t.recordKind,
        }),
      ]),
    ]),
    GOVERNANCE_SHEETS[4],
  );
  return wb;
}
export function workbookBytes(workbook: XLSX.WorkBook) {
  const bytes = new Uint8Array(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
  );
  const files = unzipSync(bytes);
  for (const key of Object.keys(files))
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(key)) {
      let xml = strFromU8(files[key]);
      const view =
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
      xml = xml.replace(/<sheetViews[\s\S]*?<\/sheetViews>/, "");
      xml = xml.replace(/(<worksheet[^>]*>)/, `$1${view}`);
      files[key] = strToU8(xml);
    }
  return zipSync(files);
}
export function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function reportName(account: string, now = new Date()) {
  return `TuanNhatKy_Report_${account.replace(/[^\p{L}\p{N}_-]/gu, "_")}_${now.toISOString().slice(0, 10)}`;
}
export function backupArchive(
  trades: ReportTrade[],
  settings: RiskSettings,
  notes: string,
  extra: Record<string, Uint8Array> = {},
) {
  const cols = [
    "id",
    "date",
    "symbol",
    "side",
    "pnl",
    "fees",
    "risk",
    "note",
  ] as const;
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-](?=\D)/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return zipSync({
    "workspace.json": strToU8(
      JSON.stringify(
        {
          format: "trading-plan-pro-backup",
          version: 2,
          exportedAt: new Date().toISOString(),
          trades: redactSecrets(trades),
          notes,
          riskSettings: settings,
        },
        null,
        2,
      ),
    ),
    "ledger.csv": strToU8(
      "\uFEFF" +
        [
          cols.join(","),
          ...trades.map((t) => cols.map((k) => cell(t[k])).join(",")),
        ].join("\r\n"),
    ),
    ...extra,
  });
}
export async function executivePdf(
  trades: ReportTrade[],
  settings: RiskSettings,
  fontBytes: Uint8Array,
  now = new Date(),
) {
  const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const page = doc.addPage([595.28, 841.89]);
  const a = riskDesk(trades, settings, now);
  const draw = (text: string, y: number, size = 11) =>
    page.drawText(text, {
      x: 40,
      y,
      font,
      size,
      color: rgb(0.08, 0.17, 0.19),
      maxWidth: 515,
    });
  draw("TUẤN NHẬT KÝ · BÁO CÁO QUẢN TRỊ", 790, 17);
  draw(now.toLocaleString("vi-VN", { timeZone: settings.timezone }), 767, 10);
  const f = (n: number | null) =>
    n === null
      ? "Chưa xác định"
      : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
  const rows = [
    ["Lệnh đã đóng / execution chưa ghép", `${a.n} / ${a.excludedFills}`],
    ["Net P&L (VNĐ)", a.financialComplete ? f(a.net) : "Thiếu phí / P&L"],
    [
      "Vốn đã thực hiện",
      settings.initialCapital ? f(a.balance) : "Chưa cấu hình vốn",
    ],
    ["Win Rate / Profit Factor", `${f(a.winRate)}% / ${f(a.profitFactor)}`],
    ["Expectancy / SQN", `${f(a.expectancyR)}R / ${f(a.sqn)}`],
    ["Sharpe / Sortino (R mỗi lệnh, Rf=0)", `${f(a.sharpe)} / ${f(a.sortino)}`],
    [
      "Max Drawdown tiền / từ đỉnh (%)",
      `${f(a.maxDD)} / ${f(a.maxDDPercent)}%`,
    ],
    ["Tầng rủi ro / ngân sách còn lại", `${a.tier} / ${f(a.remaining)}`],
    ["Điểm kỷ luật", f(a.discipline) + "%"],
    ["MAE / MFE trung bình", `${f(a.mae)} / ${f(a.mfe)}`],
    ["Giả định chỉ giữ lệnh tuân thủ", f(a.hypotheticalNet) + " VNĐ"],
  ];
  rows.forEach(([k, v], i) => {
    draw(k, 725 - i * 36, 10);
    page.drawText(v, {
      x: 355,
      y: 725 - i * 36,
      font,
      size: 10,
      color: rgb(0.08, 0.17, 0.19),
    });
  });
  draw(
    `Mẫu R: ${a.rN}/${a.n}. SQN dùng độ lệch chuẩn mẫu; không thường niên hóa.`,
    265,
    9,
  );
  draw(
    "Vốn thực hiện và lãi/lỗ đang mở được tách riêng; thiếu dữ liệu được để trống.",
    245,
    9,
  );
  draw("What-if là mô phỏng hậu kiểm, không phải dự báo kết quả.", 225, 9);
  draw(
    "Hạn mức do chủ tài khoản cấu hình; hệ thống không đặt/chặn lệnh tại sàn.",
    205,
    9,
  );
  draw(
    "Đối soát chi tiết, công thức và nguồn dữ liệu nằm trong sổ Excel 5 trang tính.",
    185,
    9,
  );
  return doc.save();
}
