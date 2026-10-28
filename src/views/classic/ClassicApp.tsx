"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  Camera,
  CalendarDays,
  Copy,
  Database,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Gauge,
  History,
  ImagePlus,
  Images,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Menu,
  NotebookPen,
  Pencil,
  Plus,
  PlugZap,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import {JournalLifecycle} from "@/src/core/journal-lifecycle.js";
import {UnifiedJournal} from "@/src/core/journal-unified.js";
import {JournalForm,JournalWindow} from "@/src/core/trade-form.js";
import AssetTradeForm from "@/app/classic/components/AssetTradeForm";
import JournalInlineCell from "@/app/classic/components/JournalInlineCell";
import { positionCycles } from "@/lib/position-cycles";
import { fetchAllTrades, saveTradeBatches } from "@/lib/read-trades";
import { useSharedRisk, useSharedNotes } from "@/lib/shared-risk-client";
import UnifiedRiskAnalyticsCockpit from "@/app/classic/components/UnifiedRiskAnalyticsCockpit";
import {
  DEFAULT_RISK,
  eventDay,
  netPnl,
  type RiskSettings,
} from "@/lib/risk-analytics";
import {
  planIngestion,
  identifyTrades,
  identifyTrade,
  sha256,
  type Resolution,
} from "@/lib/unified-ingestion";
import {
  saveLocal,
  readLocal,
  persistClassicLedger,
  readClassicLedger,
  classicSender,
  listLocal,
  removeLocal,
  queueMutation,
  flushQueue,
  listQueue,
  discardQueued,
  type QueuedMutation,
} from "@/lib/classic-persistence";
import GovernanceCenter from "@/app/classic/components/GovernanceCenter";
import "@/app/classic/cockpit.css";
import CompanyValuation from "@/app/classic/components/CompanyValuation";
import EquityTimeChart, {
  type EquityChartPoint,
} from "@/app/classic/components/EquityTimeChart";
import SystemTracker from "@/app/classic/components/SystemTracker";
import TradingMetrix from "@/app/classic/components/TradingMetrix";
import {
  normalizeNumericInput,
  selectNumericInput,
} from "@/app/classic/components/numeric-input";
import { authClient } from "@/lib/auth-client";
import {
  parseBinanceFuturesText,
  type BinanceImportedTrade,
} from "@/lib/binance-import";
import { parseTradeCsv, parseTradeWorkbook } from "@/lib/trade-import";

type View =
  | "overview"
  | "journal"
  | "calendar"
  | "analytics"
  | "risk"
  | "statistics"
  | "system-tracker"
  | "valuation"
  | "pair"
  | "setup"
  | "weekday"
  | "heatmap"
  | "process"
  | "notes"
  | "connections"
  | "settings";

type Market = "Hàng hóa" | "Chứng khoán" | "Crypto" | "Forex";
type BridgeProvider = "vps" | "ssi" | "tcx" | "mt5" | "cqg";
type Provider =
  | BridgeProvider
  | "binance"
  | "bybit"
  | "tradingview"
  | "vn-broker"
  | "webhook";
type AnalyticsTab = "symbol" | "setup" | "session" | "weekday" | "heatmap";

type Trade = {
  asset_class?: string;
  normalized?: Record<string,any>;
  unifiedV6?: Record<string,any>;
  origin?: "MOCK_SEED_V3" | "USER_LIVE" | "IMPORTED_VERIFIED";
  id: string;
  version?: number;
  openedAt?: string | null;
  closedAt?: string | null;
  mae?: number | null;
  mfe?: number | null;
  riskKnown?: boolean;
  feesKnown?: boolean;
  pnlKnown?: boolean;
  recordKind?: string;
  dedupHash?: string | null;
  semanticHash?: string | null;
  rules?: Record<string, boolean>;
  rulesJson?: string | null;
  rawPayloadJson?: string | null;
  date: string;
  symbol: string;
  side: "Buy" | "Sell";
  session: "Châu Á" | "London" | "New York";
  setup: string;
  timeframe: string;
  risk: number;
  pnl: number;
  discipline: number;
  psychology: string;
  note: string;
  durationMin: number;
  market?: Market;
  source?: string;
  accountId?: string | null;
  externalId?: string | null;
  fees?: number;
  swap?: number;
  quantity?: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  exitPrice?: number;
};

type TradeImage = {
  id: string;
  tradeId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
};

type DraftTrade = Omit<
  Trade,
  | "id"
  | "discipline"
  | "durationMin"
  | "market"
  | "source"
  | "risk"
  | "pnl"
  | "fees"
  | "quantity"
  | "entryPrice"
  | "stopLoss"
  | "takeProfit"
  | "exitPrice"
> & {
  market: Market;
  source: string;
  risk: string;
  pnl: string;
  durationMin: string;
  fees: string;
  quantity: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  exitPrice: string;
  plan: boolean;
  noFomo: boolean;
  noRevenge: boolean;
  screenshot: boolean;
};

type TradeImportPreview = {
  numberDecisions?: Array<{field:string;separator:string;ambiguous:boolean;examples:string[]}>;
  needsNumberConfirmation?: boolean;
  fileName: string;
  detected: number;
  trades: Trade[];
  errors: string[];
};

type Connection = {
  id: string;
  provider: Provider;
  label: string;
  accountType: string;
  status: string;
  lastSyncAt: string | null;
};

type ConnectionDraft = {
  provider: Provider;
  label: string;
  accountType: string;
  apiKey: string;
  apiSecret: string;
  symbols: string;
  fxRate: string;
  bridgeUrl: string;
  bridgeToken: string;
  brokerName: string;
};

const SAMPLE_TRADES: Trade[] = [
  {
    id: "T260710",
    date: "2026-07-10",
    symbol: "BẠC",
    side: "Buy",
    session: "New York",
    setup: "Breakout + Retest",
    timeframe: "H1",
    risk: 1200000,
    pnl: 2800000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Chờ giá retest vùng phá vỡ, khối lượng xác nhận.",
    durationMin: 185,
  },
  {
    id: "T260713",
    date: "2026-07-13",
    symbol: "DẦU WTI",
    side: "Sell",
    session: "New York",
    setup: "Từ chối giá",
    timeframe: "M30",
    risk: 1100000,
    pnl: -1100000,
    discipline: 75,
    psychology: "Hơi vội",
    note: "Vào sớm trước tín hiệu xác nhận.",
    durationMin: 72,
  },
  {
    id: "T260715",
    date: "2026-07-15",
    symbol: "ROBUSTA",
    side: "Buy",
    session: "London",
    setup: "Pullback xu hướng",
    timeframe: "H1",
    risk: 1300000,
    pnl: 2150000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Giữ đúng kế hoạch, chốt tại vùng cung gần nhất.",
    durationMin: 246,
  },
  {
    id: "T260717",
    date: "2026-07-17",
    symbol: "ĐẬU TƯƠNG",
    side: "Sell",
    session: "Châu Á",
    setup: "Phá cấu trúc",
    timeframe: "H4",
    risk: 900000,
    pnl: 0,
    discipline: 100,
    psychology: "Trung lập",
    note: "Dời hòa vốn khi giá đạt 1R.",
    durationMin: 390,
  },
  {
    id: "T260720",
    date: "2026-07-20",
    symbol: "ĐỒNG",
    side: "Buy",
    session: "London",
    setup: "Breakout + Retest",
    timeframe: "M30",
    risk: 1000000,
    pnl: 1800000,
    discipline: 100,
    psychology: "Tự tin",
    note: "Setup rõ, tỷ lệ R:R tốt.",
    durationMin: 128,
  },
  {
    id: "T260722",
    date: "2026-07-22",
    symbol: "BẠC",
    side: "Sell",
    session: "New York",
    setup: "Từ chối giá",
    timeframe: "M15",
    risk: 1250000,
    pnl: -1250000,
    discipline: 50,
    psychology: "FOMO",
    note: "Giao dịch ngoài khung giờ kế hoạch.",
    durationMin: 34,
  },
  {
    id: "T260724",
    date: "2026-07-24",
    symbol: "DẦU WTI",
    side: "Buy",
    session: "New York",
    setup: "Pullback xu hướng",
    timeframe: "H1",
    risk: 1150000,
    pnl: 2450000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Không đuổi giá, chờ vùng cầu.",
    durationMin: 211,
  },
  {
    id: "T260727",
    date: "2026-07-27",
    symbol: "ROBUSTA",
    side: "Sell",
    session: "London",
    setup: "Phá cấu trúc",
    timeframe: "H1",
    risk: 1050000,
    pnl: -620000,
    discipline: 75,
    psychology: "Trung lập",
    note: "Đóng sớm khi cấu trúc ngắn hạn thay đổi.",
    durationMin: 156,
  },
  {
    id: "T260729",
    date: "2026-07-29",
    symbol: "NGÔ",
    side: "Buy",
    session: "Châu Á",
    setup: "Tích lũy",
    timeframe: "H4",
    risk: 800000,
    pnl: 1520000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Khối lượng tăng tại đáy vùng giá trị.",
    durationMin: 510,
  },
  {
    id: "T260801",
    date: "2026-08-01",
    symbol: "BẠC",
    side: "Buy",
    session: "New York",
    setup: "Breakout + Retest",
    timeframe: "H1",
    risk: 1200000,
    pnl: 3200000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Lệnh A+, đủ checklist.",
    durationMin: 198,
  },
  {
    id: "T260803",
    date: "2026-08-03",
    symbol: "DẦU WTI",
    side: "Sell",
    session: "New York",
    setup: "Từ chối giá",
    timeframe: "M30",
    risk: 1200000,
    pnl: -1200000,
    discipline: 75,
    psychology: "Căng thẳng",
    note: "Khối lượng nhỏ đúng mức rủi ro.",
    durationMin: 88,
  },
  {
    id: "T260804",
    date: "2026-08-04",
    symbol: "ĐỒNG",
    side: "Buy",
    session: "London",
    setup: "Pullback xu hướng",
    timeframe: "H1",
    risk: 1000000,
    pnl: 1950000,
    discipline: 100,
    psychology: "Tự tin",
    note: "Giữ lệnh theo trailing swing low.",
    durationMin: 275,
  },
  {
    id: "T260805",
    date: "2026-08-05",
    symbol: "ĐẬU TƯƠNG",
    side: "Sell",
    session: "Châu Á",
    setup: "Phá cấu trúc",
    timeframe: "H4",
    risk: 900000,
    pnl: -900000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Thua đúng kế hoạch, không vào lại.",
    durationMin: 340,
  },
  {
    id: "T260806",
    date: "2026-08-06",
    symbol: "ROBUSTA",
    side: "Buy",
    session: "London",
    setup: "Tích lũy",
    timeframe: "H1",
    risk: 1100000,
    pnl: 2640000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Tín hiệu volume xác nhận ngay vùng hỗ trợ.",
    durationMin: 224,
  },
  {
    id: "S260728",
    date: "2026-07-28",
    symbol: "FPT",
    side: "Buy",
    session: "Châu Á",
    setup: "Breakout nền giá",
    timeframe: "Daily",
    risk: 1500000,
    pnl: 3100000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Cổ phiếu dẫn dắt, thanh khoản xác nhận.",
    durationMin: 4320,
    market: "Chứng khoán",
    source: "CSV · Broker VN",
    quantity: 500,
    fees: 180000,
  },
  {
    id: "S260805",
    date: "2026-08-05",
    symbol: "SSI",
    side: "Buy",
    session: "Châu Á",
    setup: "Pullback xu hướng",
    timeframe: "Daily",
    risk: 1200000,
    pnl: -850000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Cắt lỗ đúng ngưỡng khi mất hỗ trợ.",
    durationMin: 2880,
    market: "Chứng khoán",
    source: "CSV · Broker VN",
    quantity: 1000,
    fees: 145000,
  },
  {
    id: "C260730",
    date: "2026-07-30",
    symbol: "BTCUSDT",
    side: "Buy",
    session: "New York",
    setup: "Breakout + Retest",
    timeframe: "H4",
    risk: 1800000,
    pnl: 4250000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "Binance Futures · dữ liệu minh họa.",
    durationMin: 560,
    market: "Crypto",
    source: "Binance",
    quantity: 0.035,
    fees: 92000,
  },
  {
    id: "C260804",
    date: "2026-08-04",
    symbol: "ETHUSDT",
    side: "Sell",
    session: "New York",
    setup: "Từ chối giá",
    timeframe: "H1",
    risk: 1000000,
    pnl: -1000000,
    discipline: 75,
    psychology: "Hơi vội",
    note: "Bybit · dữ liệu minh họa.",
    durationMin: 95,
    market: "Crypto",
    source: "Bybit",
    quantity: 0.4,
    fees: 62000,
  },
  {
    id: "F260729",
    date: "2026-07-29",
    symbol: "EURUSD",
    side: "Buy",
    session: "London",
    setup: "Phá cấu trúc",
    timeframe: "H1",
    risk: 1000000,
    pnl: 2070000,
    discipline: 100,
    psychology: "Bình tĩnh",
    note: "MT5 · đóng tại vùng cung H4.",
    durationMin: 210,
    market: "Forex",
    source: "MetaTrader 5",
    quantity: 0.2,
    fees: 75000,
  },
  {
    id: "F260806",
    date: "2026-08-06",
    symbol: "XAUUSD",
    side: "Sell",
    session: "New York",
    setup: "Từ chối giá",
    timeframe: "M30",
    risk: 1300000,
    pnl: 2860000,
    discipline: 100,
    psychology: "Tự tin",
    note: "TradingView alert + MT5 execution.",
    durationMin: 135,
    market: "Forex",
    source: "TradingView",
    quantity: 0.1,
    fees: 110000,
  },
];

for (const trade of SAMPLE_TRADES) {
  trade.origin = "MOCK_SEED_V3";
  trade.market ??= "Hàng hóa";
  trade.source ??= "Thủ công";
  trade.fees ??= 0;
  trade.quantity ??= 0;
}

const DEMO_STORAGE_KEY = "tuan-trader-demo-mode-v1";
const MIN_ANALYTICS_SAMPLE = 20;
const SAMPLE_TRADE_IDS = new Set(SAMPLE_TRADES.map((trade) => trade.id));

function isDemoDataset(source: Trade[]) {
  return (
    source.length === SAMPLE_TRADES.length &&
    source.every((trade) => SAMPLE_TRADE_IDS.has(trade.id))
  );
}

type NavItem = { id: View; label: string; icon: LucideIcon };

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "01 · Trước phiên",
    items: [
      { id: "overview", label: "Buồng lái giao dịch", icon: LayoutDashboard },
      { id: "risk", label: "Bảo vệ vốn & khối lượng", icon: ShieldCheck },
    ],
  },
  {
    label: "02 · Thực thi & đối soát",
    items: [
      { id: "journal", label: "Nhật ký giao dịch", icon: BookOpen },
      { id: "calendar", label: "Lịch giao dịch", icon: CalendarDays },
      { id: "process", label: "Quy trình setup", icon: ListChecks },
      { id: "notes", label: "Ghi chú & review", icon: NotebookPen },
    ],
  },
  {
    label: "03 · Phân tích & cải thiện",
    items: [
      { id: "analytics", label: "Phân tích định lượng", icon: BarChart3 },
      { id: "statistics", label: "Trading MetriX chi tiết", icon: Gauge },
      { id: "system-tracker", label: "Theo dõi hệ thống", icon: History },
      { id: "valuation", label: "Tiện ích định giá", icon: Building2 },
    ],
  },
  {
    label: "04 · Báo cáo & đồng bộ",
    items: [
      { id: "connections", label: "Kết nối dữ liệu", icon: PlugZap },
      { id: "settings", label: "Tài khoản & báo cáo", icon: Settings },
    ],
  },
];

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  overview: {
    title: "Nhật ký giao dịch đa thị trường",
    subtitle: "Tổng quan hiệu suất · Kỷ luật · Quản trị rủi ro",
  },
  journal: {
    title: "Nhật ký giao dịch",
    subtitle: "Mỗi lệnh là một dữ liệu để bạn tiến bộ",
  },
  calendar: {
    title: "Lịch giao dịch",
    subtitle: "Nhìn lại nhịp độ và kết quả theo ngày",
  },
  analytics: {
    title: "Phân tích",
    subtitle: "Tìm lợi thế thật sự trong dữ liệu giao dịch",
  },
  risk: {
    title: "Lợi nhuận · Rủi ro",
    subtitle: "Bảo vệ vốn trước khi nghĩ đến lợi nhuận",
  },
  statistics: {
    title: "Trading MetriX",
    subtitle: "Mục tiêu · Equity · Giới hạn rủi ro · Hiệu suất chuyên sâu",
  },
  "system-tracker": {
    title: "Theo dõi hệ thống",
    subtitle: "Hồ sơ hiệu suất theo năm · Tự cập nhật từ 2026 về sau",
  },
  valuation: {
    title: "Định giá doanh nghiệp",
    subtitle: "9 mô hình · Kiểm tra chéo · Kỳ vọng thị trường · Xác suất",
  },
  pair: {
    title: "Hiệu suất sản phẩm",
    subtitle: "Sản phẩm nào đang tạo ra lợi thế?",
  },
  setup: {
    title: "Hiệu suất setup",
    subtitle: "Đo chất lượng từng mô hình giao dịch",
  },
  weekday: {
    title: "Hiệu suất theo thứ",
    subtitle: "Chọn đúng ngày để tập trung",
  },
  heatmap: {
    title: "Bản đồ nhiệt",
    subtitle: "Mật độ và hiệu suất theo ngày trong tuần",
  },
  process: {
    title: "Quy trình setup",
    subtitle: "Chuẩn hóa quyết định trước, trong và sau giao dịch",
  },
  notes: {
    title: "Ghi chú & review",
    subtitle: "Ghi sự thật, đánh giá quy trình và chốt hành động cải thiện",
  },
  connections: {
    title: "Kết nối broker",
    subtitle: "Hợp nhất dữ liệu từ sàn và nền tảng giao dịch",
  },
  settings: { title: "Cài đặt", subtitle: "Cá nhân hóa nhật ký giao dịch" },
};

const NOTE_TEMPLATES = [
  {
    id: "daily-plan",
    code: "01",
    label: "Kế hoạch ngày",
    description: "Bối cảnh, kịch bản và giới hạn rủi ro trước phiên.",
    content: `KẾ HOẠCH GIAO DỊCH — [Ngày]

1. BỐI CẢNH KHÁCH QUAN
- Trạng thái thị trường (xu hướng / đi ngang / biến động cao):
- Vùng giá và mốc thời gian quan trọng:
- Tin tức hoặc sự kiện cần tránh:

2. KỊCH BẢN GIAO DỊCH
- Kịch bản ưu tiên:
- Điều kiện kích hoạt setup:
- Điểm làm luận điểm mất hiệu lực:
- Kịch bản thay thế / điều kiện đứng ngoài:

3. KẾ HOẠCH RỦI RO
- Rủi ro tối đa mỗi lệnh: ___%
- Mức dừng trong ngày: ___R
- Số lệnh tối đa: ___

4. CAM KẾT THỰC THI
- Tôi chỉ vào lệnh khi đủ điều kiện A+.
- Tôi không đuổi giá, nới SL hoặc trả thù thị trường.`,
  },
  {
    id: "trade-review",
    code: "02",
    label: "Review một lệnh",
    description: "Đánh giá chất lượng quyết định, không chỉ nhìn P&L.",
    content: `REVIEW GIAO DỊCH — [Mã / Ngày / Phiên]

1. SỰ THẬT
- Setup và khung thời gian:
- Entry / SL / TP / kết quả (R và số tiền):
- Ảnh trước lệnh / sau lệnh:

2. LUẬN ĐIỂM BAN ĐẦU
- Lợi thế được kỳ vọng:
- Tín hiệu kích hoạt:
- Điều kiện làm setup mất hiệu lực:

3. CHẤT LƯỢNG THỰC THI
- Đúng setup: Có / Không
- Đúng khối lượng và rủi ro: Có / Không
- Tuân thủ kế hoạch quản lý lệnh: Có / Không
- Trạng thái tâm lý (trước / trong / sau):

4. KẾT LUẬN
- Điều đã làm đúng:
- Sai lệch so với kế hoạch:
- Một bài học có thể kiểm chứng:
- Một hành động cụ thể cho lệnh tiếp theo:`,
  },
  {
    id: "weekly-review",
    code: "03",
    label: "Review tuần",
    description: "Tổng hợp dữ liệu, sai lệch và ưu tiên cải thiện tuần tới.",
    content: `REVIEW TUẦN — [Từ ngày / Đến ngày]

1. KẾT QUẢ & CỠ MẪU
- Tổng số lệnh / P&L / R ròng:
- Win rate / Profit factor / Drawdown:
- Setup đủ mẫu để đánh giá:

2. CHẤT LƯỢNG QUY TRÌNH
- Tỷ lệ lệnh đúng kế hoạch:
- Quy tắc được tuân thủ tốt nhất:
- Sai lệch đang lặp lại và tác động:

3. ĐÁNH GIÁ LỢI THẾ
- Setup / phiên / sản phẩm hoạt động tốt:
- Dữ liệu nào còn chưa đủ để kết luận:
- Điều gì tuyệt đối không thay đổi chỉ vì một vài lệnh:

4. KẾ HOẠCH TUẦN TỚI
- Tiếp tục:
- Loại bỏ:
- Thử nghiệm (rủi ro không đổi):
- Một mục tiêu hành vi có thể đo lường:`,
  },
] as const;

const TRADE_REVIEW_TEMPLATE = `BỐI CẢNH & LUẬN ĐIỂM
- Dữ kiện khách quan trước khi vào lệnh:
- Vì sao setup này có lợi thế:
- Điều kiện làm luận điểm mất hiệu lực:

THỰC THI
- Điều đã làm đúng theo kế hoạch:
- Sai lệch trong entry / quản lý / thoát lệnh:
- Tâm lý ảnh hưởng đến quyết định:

KẾT LUẬN
- Một bài học có thể kiểm chứng:
- Một hành động cụ thể cho lệnh tiếp theo:`;

const MARKETS: { id: "all" | Market; label: string; icon: string }[] = [
  { id: "all", label: "Tất cả", icon: "◎" },
  { id: "Hàng hóa", label: "Hàng hóa", icon: "◈" },
  { id: "Chứng khoán", label: "Chứng khoán", icon: "▥" },
  { id: "Crypto", label: "Crypto", icon: "₿" },
  { id: "Forex", label: "Forex", icon: "↕" },
];

const BROKERS: {
  provider: Provider;
  name: string;
  badge: string;
  mode: string;
  copy: string;
  scope: string;
}[] = [
  {
    provider: "vps",
    name: "VPS",
    badge: "VP",
    mode: "Push 24/7 · Pull bridge",
    copy: "Nhận lịch sử khớp lệnh qua bridge cục bộ/đối tác, mặc định nhận diện chứng khoán.",
    scope: "✓ Cổ phiếu · Phái sinh VN",
  },
  {
    provider: "ssi",
    name: "SSI FastConnect",
    badge: "SSI",
    mode: "Push 24/7 · Pull bridge",
    copy: "Sẵn sàng cho bridge FastConnect; khóa ký và PIN/OTP luôn nằm ngoài journal.",
    scope: "✓ Cơ sở · Phái sinh SSI",
  },
  {
    provider: "tcx",
    name: "TCX / TCBS",
    badge: "TCX",
    mode: "Push 24/7 · Pull bridge",
    copy: "Nhận giao dịch TCX/TCBS qua bridge hoặc trình theo dõi statement tự động.",
    scope: "✓ Cổ phiếu · Trái phiếu",
  },
  {
    provider: "mt5",
    name: "MetaTrader 5",
    badge: "M5",
    mode: "Push 24/7 · Pull bridge",
    copy: "Bridge Python/EA đọc deal đã đóng từ terminal MT5 rồi tự cập nhật journal.",
    scope: "✓ Forex · CFD · Gold",
  },
  {
    provider: "cqg",
    name: "CQG",
    badge: "CQG",
    mode: "Push 24/7 · Pull bridge",
    copy: "Nhận execution và lịch sử lệnh từ CQG WebAPI qua bridge được broker cấp quyền.",
    scope: "✓ Futures · Hàng hóa",
  },
  {
    provider: "binance",
    name: "Binance",
    badge: "BN",
    mode: "API chỉ đọc",
    copy: "Đồng bộ Spot hoặc Futures theo danh sách symbol bạn chọn.",
    scope: "✓ Spot & phái sinh",
  },
  {
    provider: "bybit",
    name: "Bybit",
    badge: "BY",
    mode: "API chỉ đọc",
    copy: "Đồng bộ lịch sử execution của Spot hoặc USDT Perpetual.",
    scope: "✓ Spot & phái sinh",
  },
  {
    provider: "tradingview",
    name: "TradingView",
    badge: "TV",
    mode: "Alert workflow",
    copy: "Chuẩn bị payload alert để ghép tín hiệu với lệnh thực thi.",
    scope: "✓ Alert JSON",
  },
  {
    provider: "vn-broker",
    name: "Broker chứng khoán VN",
    badge: "VN",
    mode: "CSV đa định dạng",
    copy: "Nhập lịch sử từ VPS, SSI, TCBS, VNDIRECT, MBS và broker khác.",
    scope: "✓ Giao dịch cơ sở",
  },
  {
    provider: "webhook",
    name: "Auto Import Hub",
    badge: "AI",
    mode: "Webhook bảo mật",
    copy: "Nhận lệnh tự động từ broker, sàn hoặc công cụ trung gian khác.",
    scope: "✓ Stock · Forex · Coin · CQG",
  },
];

const BRIDGE_PROVIDERS: BridgeProvider[] = ["vps", "ssi", "tcx", "mt5", "cqg"];
const AUTO_SYNC_PROVIDERS: Provider[] = [
  "vps",
  "ssi",
  "tcx",
  "mt5",
  "cqg",
  "binance",
  "bybit",
];
const UNCLASSIFIED_SETUP = "Chưa phân loại";
const WEBHOOK_ENDPOINT_PATH = "/api/import/webhook";

const BRIDGE_DETAILS: Record<
  BridgeProvider,
  {
    market: Market;
    source: string;
    symbol: string;
    externalId: string;
    notice: string;
    foreignCurrency: boolean;
  }
> = {
  vps: {
    market: "Chứng khoán",
    source: "VPS",
    symbol: "FPT",
    externalId: "vps-match-123456",
    foreignCurrency: false,
    notice:
      "VPS cần bridge cục bộ/đối tác hoặc watcher lịch sử. Bridge chỉ gửi lệnh đã khớp; journal không giữ mật khẩu giao dịch.",
  },
  ssi: {
    market: "Chứng khoán",
    source: "SSI FastConnect",
    symbol: "SSI",
    externalId: "ssi-match-123456",
    foreignCurrency: false,
    notice:
      "FastConnect bridge giữ ConsumerSecret, PrivateKey và PIN/OTP bên ngoài journal; chỉ đẩy dữ liệu lịch sử khớp lệnh.",
  },
  tcx: {
    market: "Chứng khoán",
    source: "TCX / TCBS",
    symbol: "TCB",
    externalId: "tcx-match-123456",
    foreignCurrency: false,
    notice:
      "TCX/TCBS cần bridge cục bộ/đối tác hoặc watcher statement. Journal chỉ nhận dữ liệu đã chuẩn hóa.",
  },
  mt5: {
    market: "Forex",
    source: "MetaTrader 5",
    symbol: "EURUSD",
    externalId: "mt5-deal-123456",
    foreignCurrency: true,
    notice:
      "Bridge Python/EA đọc history deal từ terminal MT5 và chỉ gửi deal đã đóng; mật khẩu tài khoản MT5 không đi vào journal.",
  },
  cqg: {
    market: "Hàng hóa",
    source: "CQG",
    symbol: "XAUUSD",
    externalId: "cqg-exec-123456",
    foreignCurrency: true,
    notice:
      "CQG WebAPI cần quyền truy cập do broker/FCM cấp. Bridge giữ phiên CQG và chỉ chuyển execution/post-trade sang journal.",
  },
};

function isBridgeProvider(provider: Provider): provider is BridgeProvider {
  return BRIDGE_PROVIDERS.includes(provider as BridgeProvider);
}

function isAutoSyncConnection(connection: Connection) {
  return (
    AUTO_SYNC_PROVIDERS.includes(connection.provider) &&
    (!isBridgeProvider(connection.provider) ||
      connection.accountType !== "push")
  );
}

function bridgePayloadExample(provider: BridgeProvider) {
  const profile = BRIDGE_DETAILS[provider];
  return JSON.stringify(
    {
      externalId: profile.externalId,
      symbol: profile.symbol,
      side: "BUY",
      closedAt: "2026-08-08T09:30:00Z",
      pnl: profile.foreignCurrency ? 48.5 : 1250000,
      fees: profile.foreignCurrency ? 1.2 : 45000,
      quantity: profile.foreignCurrency ? 0.2 : 500,
      entryPrice: profile.foreignCurrency ? 1.1625 : 125000,
      exitPrice: profile.foreignCurrency ? 1.1649 : 127500,
    },
    null,
    2,
  );
}

const SETUP_GROUPS: Array<{ label: string; options: string[] }> = [
  {
    label: "Xu hướng & động lượng",
    options: [
      "Breakout + Retest",
      "Pullback xu hướng",
      "Momentum Continuation",
      "Continuation sau tích lũy",
      "Trendline Break + Retest",
      "EMA / MA Pullback",
      "Flag / Pennant Continuation",
    ],
  },
  {
    label: "Cấu trúc thị trường & Price Action",
    options: [
      "BOS + Retest",
      "CHoCH Reversal",
      "Từ chối hỗ trợ / kháng cự",
      "False Breakout / Liquidity Sweep",
      "Range Breakout",
      "Range Rejection",
      "Supply & Demand",
      "Order Block + FVG",
      "Pin Bar / Engulfing xác nhận",
    ],
  },
  {
    label: "Khối lượng & phiên giao dịch",
    options: [
      "Volume Breakout",
      "Volume Profile HVN / LVN",
      "VWAP Reclaim / Reject",
      "Opening Range Breakout (ORB)",
      "Gap & Go",
      "Failed Auction",
    ],
  },
  {
    label: "Mô hình giá cổ điển",
    options: [
      "Double Top / Double Bottom",
      "Head & Shoulders",
      "Triangle / Wedge Breakout",
      "Cup & Handle",
      "Rounded Base Breakout",
    ],
  },
  {
    label: "Đảo chiều & hồi quy trung bình",
    options: [
      "Mean Reversion",
      "Divergence Reversal",
      "Exhaustion Reversal",
      "Wyckoff Spring / Upthrust",
      "Climax Volume Reversal",
    ],
  },
];
const SETUP_OPTIONS = SETUP_GROUPS.flatMap((group) => group.options);

const MONEY = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function money(value: number, compact = false) {
  if (!compact) return MONEY.format(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000)
    return `${sign}${(absolute / 1_000_000).toFixed(1)}tr`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${sign}${absolute}`;
}

function dayName(date: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function marketOf(trade: Trade): Market {
  return trade.market ?? "Hàng hóa";
}

function makeDraft(): DraftTrade {
  return {
    date: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
    symbol: "",
    side: "Buy",
    session: "New York",
    setup: UNCLASSIFIED_SETUP,
    timeframe: "H1",
    risk: "",
    pnl: "",
    psychology: "Chưa review",
    note: "",
    durationMin: "",
    fees: "",
    quantity: "",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    exitPrice: "",
    plan: false,
    noFomo: false,
    noRevenge: false,
    screenshot: false,
    market: "Hàng hóa",
    source: "Thủ công",
  };
}

function makeDraftFromTrade(trade: Trade): DraftTrade {
  const checked = Math.max(0, Math.min(4, Math.round(trade.discipline / 25)));
  return {
    date: trade.date,
    symbol: trade.symbol,
    side: trade.side,
    session: trade.session,
    setup: trade.setup,
    timeframe: trade.timeframe,
    risk: String(trade.risk),
    pnl: String(trade.pnl),
    psychology: trade.psychology,
    note: trade.note,
    durationMin: trade.durationMin ? String(trade.durationMin) : "",
    fees: trade.fees ? String(trade.fees) : "",
    quantity: trade.quantity ? String(trade.quantity) : "",
    entryPrice: trade.entryPrice ? String(trade.entryPrice) : "",
    stopLoss: trade.stopLoss ? String(trade.stopLoss) : "",
    takeProfit: trade.takeProfit ? String(trade.takeProfit) : "",
    exitPrice: trade.exitPrice ? String(trade.exitPrice) : "",
    plan: checked >= 1,
    noFomo: checked >= 2,
    noRevenge: checked >= 3,
    screenshot: checked >= 4,
    market: marketOf(trade),
    source: trade.source ?? "Thủ công",
  };
}

function makeConnectionDraft(provider: Provider): ConnectionDraft {
  const broker = BROKERS.find((item) => item.provider === provider);
  const stockBridge =
    provider === "vps" || provider === "ssi" || provider === "tcx";
  return {
    provider,
    label: broker?.name ?? provider,
    accountType: isBridgeProvider(provider)
      ? "push"
      : provider === "bybit"
        ? "linear"
        : provider === "binance"
          ? "futures"
          : "default",
    apiKey: "",
    apiSecret: "",
    symbols: "BTCUSDT, ETHUSDT, SOLUSDT",
    fxRate: stockBridge ? "1" : "26000",
    bridgeUrl: "",
    bridgeToken: "",
    brokerName: "VPS",
  };
}

function calculateStats(raw: Trade[]) {
  const source = raw
    .filter((t) => t.recordKind !== "fill")
    .map((t) => ({ ...t, pnl: netPnl(t) }));
  const ordered = [...source].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const wins = source.filter((t) => t.pnl > 0);
  const losses = source.filter((t) => t.pnl < 0);
  const breakeven = source.filter((t) => t.pnl === 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const net = grossProfit - grossLoss;
  const risk = source.reduce((sum, t) => sum + t.risk, 0);
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let currentWin = 0;
  let currentLoss = 0;
  let longestWin = 0;
  let longestLoss = 0;
  for (const trade of ordered) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    if (trade.pnl > 0) {
      currentWin += 1;
      currentLoss = 0;
      longestWin = Math.max(longestWin, currentWin);
    } else if (trade.pnl < 0) {
      currentLoss += 1;
      currentWin = 0;
      longestLoss = Math.max(longestLoss, currentLoss);
    }
  }
  const mean = source.length ? net / source.length : 0;
  const variance = source.length
    ? source.reduce((sum, t) => sum + (t.pnl - mean) ** 2, 0) / source.length
    : 0;
  const deviation = Math.sqrt(variance);
  const last = ordered.at(-1);
  let currentStreak = 0;
  if (last) {
    const positive = last.pnl > 0;
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      if (ordered[index].pnl > 0 === positive && ordered[index].pnl !== 0)
        currentStreak += 1;
      else break;
    }
    if (!positive) currentStreak *= -1;
  }
  return {
    total: source.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    grossProfit,
    grossLoss,
    net,
    winRate: source.length ? (wins.length / source.length) * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : 0,
    averageR: source.length
      ? source.reduce((sum, t) => sum + (t.risk ? t.pnl / t.risk : 0), 0) /
        source.length
      : 0,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    expectancy: source.length ? net / source.length : 0,
    maxDrawdown,
    recovery: maxDrawdown ? net / maxDrawdown : 0,
    sharpe: deviation ? mean / deviation : 0,
    longestWin,
    longestLoss,
    currentStreak,
    avgDuration: source.length
      ? source.reduce((sum, t) => sum + t.durationMin, 0) / source.length
      : 0,
    biggestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0,
    biggestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0,
    roi: risk ? (net / risk) * 100 : 0,
    discipline: source.length
      ? source.reduce((sum, t) => sum + t.discipline, 0) / source.length
      : 0,
  };
}

function groupTrades(
  raw: Trade[],
  key: "symbol" | "setup" | "session" | "weekday",
) {
  const source = raw
    .filter((t) => t.recordKind !== "fill")
    .map((t) => ({ ...t, pnl: netPnl(t) }));
  const map = new Map<
    string,
    { label: string; pnl: number; count: number; wins: number }
  >();
  for (const trade of source) {
    const label = key === "weekday" ? dayName(trade.date) : String(trade[key]);
    const current = map.get(label) ?? { label, pnl: 0, count: 0, wins: 0 };
    current.pnl += trade.pnl;
    current.count += 1;
    current.wins += trade.pnl > 0 ? 1 : 0;
    map.set(label, current);
  }
  return [...map.values()].sort((a, b) => b.pnl - a.pnl);
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <span>◇</span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export default function Home() {
  const { data: accountSession, isPending: accountSessionPending } =
    authClient.useSession();
  const [siteUser, setSiteUser] = useState<{ id: string } | null>();
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/site-session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) =>
        r.ok ? ((await r.json()) as { user: { id: string } }).user : null,
      )
      .then((user) => {
        if (!controller.signal.aborted) setSiteUser(user);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSiteUser(null);
      });
    return () => controller.abort();
  }, []);
  const accountId = accountSession?.user.id ?? siteUser?.id ?? "device";
  const WEBHOOK_ENDPOINT =
    typeof window === "undefined"
      ? WEBHOOK_ENDPOINT_PATH
      : window.location.origin + WEBHOOK_ENDPOINT_PATH;
  const storageSuffix = accountId === "device" ? "" : `:${accountId}`;
  const tradesStorageKey = `tuan-trader-trades${storageSuffix}`;
  const notesStorageKey = `tuan-trader-notes${storageSuffix}`;
  const demoStorageKey = `${DEMO_STORAGE_KEY}${storageSuffix}`;
  const [view, setView] = useState<View>("overview");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [range, setRange] = useState("all");
  const [query, setQuery] = useState("");
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [journalMarket, setJournalMarket] = useState<"all" | Market>("all");
  const [marketScope, setMarketScope] = useState<"all" | Market>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [assetInput,setAssetInput]=useState<Record<string,any>>(()=>JournalForm.blank('COMMODITY_FUTURES','VND'));
  const editBaseline=useRef<string|null>(null);
  const [draftImages, setDraftImages] = useState<File[]>([]);
  const [tradeImages, setTradeImages] = useState<TradeImage[]>([]);
  const [imageTradeId, setImageTradeId] = useState("");
  const [imageTradeQuery,setImageTradeQuery]=useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [activeImage, setActiveImage] = useState<TradeImage | null>(null);
  const [connectProvider, setConnectProvider] = useState<Provider | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>(() =>
    makeConnectionDraft("binance"),
  );
  const [connections, setConnections] = useState<Connection[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncStatus, setAutoSyncStatus] = useState(
    "Chọn đồng bộ ngay hoặc bật tự đồng bộ",
  );
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [localFallback, setLocalFallback] = useState(false);
  const [webhookToken, setWebhookToken] = useState("");
  const [dataMode, setDataMode] = useState<"cloud" | "device">("device");
  const [mobileNav, setMobileNav] = useState(false);
  const [draft, setDraft] = useState<DraftTrade>(makeDraft);
  const [toast, setToast] = useState("");
  const [tradeImportPreview, setTradeImportPreview] =
    useState<TradeImportPreview | null>(null);
  const [tradeImportBusy, setTradeImportBusy] = useState(false);
  const importFileV33=useRef<File|null>(null);
  const [numberChoice,setNumberChoice]=useState<""|"."|",">("");
  const [notes, setNotes] = useState<string>(NOTE_TEMPLATES[0].content);
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(DEFAULT_RISK);
  const [persistenceOwner, setPersistenceOwner] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [queueItems, setQueueItems] = useState<QueuedMutation[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [ingestionPlan, setIngestionPlan] = useState<Awaited<
    ReturnType<typeof planIngestion<Trade>>
  > | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    {},
  );
  const [importCurrency, setImportCurrency] = useState("VND");
  const [importFx, setImportFx] = useState("");
  const importRaw = useRef<Trade[]>([]);
  const [importAccount, setImportAccount] = useState("");
  const [importBroker, setImportBroker] = useState("");
  const [lastReceipt, setLastReceipt] = useState<
    import("@/lib/governance-report").AuditReceipt
  >({});
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 7, 1));

  const syncAllLock = useRef(false);
  useSharedNotes(
    dataMode === "cloud" && persistenceOwner === accountId
      ? accountId
      : undefined,
    notes,
    setNotes,
    setToast,
    NOTE_TEMPLATES[0].content,
  );
  useSharedRisk(
    dataMode === "cloud" && persistenceOwner === accountId
      ? accountId
      : undefined,
    riskSettings,
    setRiskSettings,
    setToast,
  );
  const syncAllConnectionsRef = useRef<
    (silent?: boolean, staleOnly?: boolean) => Promise<void>
  >(async () => undefined);

  useEffect(() => {
    if (accountSessionPending || siteUser === undefined) return;
    let active = true;
    setPersistenceOwner(null);
    setDraftRestored(false);
    setDraft(makeDraft());
    setEditingTradeId(null);
    setRiskSettings(DEFAULT_RISK);
    void Promise.all([
      readLocal<RiskSettings>("risk:" + accountId),
      readLocal<{
        draft: DraftTrade;
        editingTradeId: string | null;
        images?: File[];
      }>("draft:" + accountId),
    ])
      .then(([risk, saved]) => {
        if (!active) return;
        setRiskSettings(risk ? { ...DEFAULT_RISK, ...risk } : DEFAULT_RISK);
        if (saved) {
          setDraft(saved.draft);
          setEditingTradeId(saved.editingTradeId);
          setDraftImages(saved.images ?? []);
          setDraftRestored(true);
        }
        setPersistenceOwner(accountId);
      })
      .catch(() => {
        if (active) {
          setPersistenceOwner(accountId);
          setToast(
            "Bộ nhớ nháp chưa khả dụng; hãy kiểm tra quyền lưu trên trình duyệt.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [accountId, accountSessionPending, siteUser]);
  useEffect(() => {
    if (persistenceOwner !== accountId) return;
    const timer = setTimeout(() => {
      void Promise.all([
        saveLocal("risk:" + accountId, riskSettings),
        saveLocal("notes:" + accountId, notes),
      ]).catch(() => setToast("Chưa lưu được nháp; hãy xuất bản sao."));
      window.localStorage.setItem(notesStorageKey, notes);
    }, 200);
    return () => clearTimeout(timer);
  }, [accountId, persistenceOwner, riskSettings, notes, notesStorageKey]);
  useEffect(() => {
    if (persistenceOwner !== accountId || !modalOpen) return;
    const timer = setTimeout(() => {
      void saveLocal("draft:" + accountId, {
        draft,
        editingTradeId,
        images: draftImages,
      }).catch(() => setToast("Chưa lưu được nháp giao dịch."));
    }, 200);
    return () => clearTimeout(timer);
  }, [
    accountId,
    persistenceOwner,
    draft,
    editingTradeId,
    draftImages,
    modalOpen,
  ]);
  useEffect(() => {
    const readFilters = () => {
      const params = new URLSearchParams(location.search);
      setQuery(params.get("q") ?? "");
      setSymbolFilter(params.get("symbol") ?? "all");
      setResultFilter(params.get("result") ?? "all");
      setRange(params.get("range") ?? "all");
      setDayFilter(params.get("day") ?? "");
      const scope = params.get("market");
      if (
        ["all", "Hàng hóa", "Chứng khoán", "Crypto", "Forex"].includes(
          scope ?? "",
        )
      )
        setMarketScope(scope as Market | "all");
    };
    readFilters();
    window.addEventListener("popstate", readFilters);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("popstate", readFilters);
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      const url = new URL(location.href);
      for (const [k, v] of Object.entries({
        q: query,
        symbol: symbolFilter,
        result: resultFilter,
        range,
        day: dayFilter,
        market: marketScope,
      })) {
        if (!v || v === "all") url.searchParams.delete(k);
        else url.searchParams.set(k, v);
      }
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, symbolFilter, resultFilter, range, dayFilter, marketScope]);
  const refreshQueue = () => {
    void listQueue(accountId).then(setQueueItems);
  };
  useEffect(() => {
    if (dataMode !== "cloud" || persistenceOwner !== accountId) return;
    const run = () => {
      void flushQueue(accountId, refreshQueue);
      refreshQueue();
    };
    run();
    window.addEventListener("online", run);
    const id = setInterval(run, 30000);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", run);
    };
  }, [accountId, dataMode, persistenceOwner]);
  useEffect(() => {
    if (!modalOpen) return;
    const paste = async (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) =>
        f.type.startsWith("image/"),
      );
      if (!files.length) return;
      e.preventDefault();
      try {
        const { compressEvidence } = await import("@/lib/evidence-image");
        const compressed = await Promise.all(files.map(compressEvidence));
        setDraftImages((v) => [...v, ...compressed].slice(0, 4));
        setDraft((v) => ({ ...v, screenshot: true }));
      } catch {
        setToast("Không thể nén ảnh; dùng JPG/PNG/WEBP dưới 8MB.");
      }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [modalOpen]);

  useEffect(() => {
    if (dataMode !== "cloud" || persistenceOwner !== accountId || localFallback)
      return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || modalOpen) return;
      try {
        if ((await listQueue(accountId)).length) return;
        const response = await fetchAllTrades({ headers: { "X-Journal-Owner": accountId } });
        if (!response.ok) return;
        const payload = (await response.json()) as { trades?: Trade[] };
        if (
          active &&
          Array.isArray(payload.trades) &&
          (!trades.length || payload.trades.length) &&
          !(await listQueue(accountId)).length
        ) {
          setTrades(payload.trades);
          void persistClassicLedger(tradesStorageKey, payload.trades).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
        }
      } catch {
        /* retain device copy */
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [
    dataMode,
    persistenceOwner,
    accountId,
    modalOpen,
    tradesStorageKey,
    trades,
    localFallback,
  ]);

  useEffect(()=>{
    let active=true;
    const refresh=async(reset=false)=>{try{if(!reset&&localStorage.getItem(demoStorageKey)==='true'&&!JournalLifecycle.read(accountId).noMock)return;const state=await UnifiedJournal.ensure(accountId);if(!active)return;UnifiedJournal.snapshots.set(accountId,state);setTrades(state.rows as Trade[]);setRiskSettings(prior=>state.settings?({...DEFAULT_RISK,...state.settings} as RiskSettings):reset?{...DEFAULT_RISK,cashFlows:[]}:prior);if(reset){setIsDemo(false);setAutoSyncEnabled(false);setNotes('');}else setIsDemo(false);}catch(e){if(active)setToast(e instanceof Error?e.message:String(e));}};
    const unsubscribe=UnifiedJournal.subscribe((delta:{owner:string;reset?:boolean})=>{if(delta.owner===accountId)void refresh(!!delta.reset);});
    let channel:BroadcastChannel|undefined;try{channel=new BroadcastChannel('tuan-classic-journal');channel.onmessage=event=>{if(event.data?.sender!==classicSender)void refresh();};}catch{}
    return ()=>{active=false;unsubscribe();channel?.close();};
  },[accountId,demoStorageKey]);

  const draftImagePreviews = useMemo(
    () => draftImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [draftImages],
  );

  useEffect(() => {
    return () =>
      draftImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [draftImagePreviews]);

  useEffect(() => {
    if (accountSessionPending || siteUser === undefined) return;
    const controller = new AbortController();
    let active = true;
    let stored = window.localStorage.getItem(tradesStorageKey);
    const storedNotes = window.localStorage.getItem(notesStorageKey);
    const storedDemoMode = window.localStorage.getItem(demoStorageKey);
    const storageTimer = window.setTimeout(() => {
      void (async()=>{
      const cached=await readClassicLedger(tradesStorageKey);if(!active)return;stored=JSON.stringify(cached);
      const lifecycle=JournalLifecycle.read(accountId);
      const showDemo=lifecycle.status==="DEMO_SANDBOX"&&!lifecycle.noMock;
      setTrades(showDemo?SAMPLE_TRADES:[]);
      setIsDemo(showDemo);
      setDataMode("device");
      setLocalFallback(false);
      setConnections([]);
      setTradeImages([]);
      setAutoSyncEnabled(false);
      if (stored) {
        try {
          const localTrades = JSON.parse(stored) as Trade[];
          if (!Array.isArray(localTrades)) throw Error("INVALID_LOCAL_TRADES");
          setTrades(localTrades);
          setIsDemo(
            storedDemoMode === "true" ||
              (storedDemoMode === null && isDemoDataset(localTrades)),
          );
        } catch {
          setToast("Không đọc được dữ liệu cũ; bản gốc được giữ. Hãy tải sao lưu trước khi sửa.");
        }
      }
      setNotes(storedNotes ?? NOTE_TEMPLATES[0].content);
      void (async () => {
        try {
          const response = await fetchAllTrades({
            headers: { "X-Journal-Owner": accountId },
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.status === 401) return;
          if (!response.ok) return;
          const payload = (await response.json()) as { trades?: Trade[] };
          if (!active || controller.signal.aborted) return;
          if (!Array.isArray(payload.trades))
            throw Error("Cloud response missing trades");
          setDataMode("cloud");
          let cloudTrades = payload.trades ?? [];
          const queued = await listQueue(accountId);
          const pending = new Map(cloudTrades.map((t) => [t.id, t]));
          for (const item of queued) {
            const body = item.body as
              { trade?: Trade; trades?: Trade[] } | undefined;
            if (item.method === "DELETE") {
              const id = new URL(
                item.url,
                window.location.origin,
              ).searchParams.get("id");
              if (id) pending.delete(id);
            } else
              for (const t of body?.trades ?? (body?.trade ? [body.trade] : []))
                pending.set(t.id, { ...pending.get(t.id), ...t });
          }
          cloudTrades = [...pending.values()];
          if (
            !cloudTrades.length &&
            stored &&
            (JSON.parse(stored) as Trade[]).length
          ) {
            setLocalFallback(true);
            setToast("Cloud đang trống; đã giữ nguyên nhật ký trên thiết bị.");
            return;
          }
          if (stored && stored !== JSON.stringify(cloudTrades))await saveLocal(`recovery:${tradesStorageKey}:${Date.now()}`,{trades:stored,notes:storedNotes,demo:storedDemoMode});
          setLocalFallback(false);
          setTrades(cloudTrades);
          setIsDemo(false);
          void persistClassicLedger(tradesStorageKey, cloudTrades).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
          window.localStorage.setItem(demoStorageKey, "false");
        } catch {
          /* preview and offline mode keep device data */
        }
      })();
      void loadConnections(controller.signal);
      void loadTradeImages(controller.signal);
      })().catch(()=>setToast("Chưa đọc được nhật ký trên thiết bị."));
    }, 0);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(storageTimer);
    };
  }, [
    accountSessionPending,
    siteUser,
    accountId,
    demoStorageKey,
    notesStorageKey,
    tradesStorageKey,
  ]);

  useEffect(() => {
    if (!modalOpen && !connectProvider && !activeImage) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setModalOpen(false);
      setConnectProvider(null);
      setActiveImage(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [modalOpen, connectProvider, activeImage]);

  useEffect(() => {
    const syncViewFromUrl = () => {
      const requested = window.location.hash.slice(1) as View;
      if (
        requested &&
        Object.prototype.hasOwnProperty.call(VIEW_META, requested)
      )
        setView(requested);
      else if (!requested) setView("overview");
    };
    syncViewFromUrl();
    window.addEventListener("hashchange", syncViewFromUrl);
    window.addEventListener("popstate", syncViewFromUrl);
    return () => {
      window.removeEventListener("hashchange", syncViewFromUrl);
      window.removeEventListener("popstate", syncViewFromUrl);
    };
  }, []);

  useEffect(() => {
    document.title = `${VIEW_META[view].title} · Trading Plan Pro`;
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredByRange = useMemo(() => {
    const dated = trades.map((t) => ({
      ...t,
      date: eventDay(t, riskSettings.timezone),
    }));
    const marketTrades =
      marketScope === "all"
        ? dated
        : dated.filter((trade) => marketOf(trade) === marketScope);
    const scoped = marketTrades.filter(
      (t) =>
        (!dayFilter || t.date === dayFilter) &&
        (symbolFilter === "all" || t.symbol === symbolFilter) &&
        (!query ||
          `${t.symbol} ${t.setup} ${t.note}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (resultFilter === "all" ||
          (resultFilter === "win"
            ? netPnl(t) > 0
            : resultFilter === "loss"
              ? netPnl(t) < 0
              : netPnl(t) === 0)),
    );
    if (range === "all") return scoped;
    const maxDate = new Date();
    const days = Number(range);
    const cutoff = new Date(maxDate);
    cutoff.setDate(cutoff.getDate() - days);
    return scoped.filter(
      (trade) => new Date(`${trade.date}T12:00:00`) >= cutoff,
    );
  }, [
    range,
    trades,
    marketScope,
    dayFilter,
    symbolFilter,
    query,
    resultFilter,
    riskSettings.timezone,
  ]);

  const stats = useMemo(
    () => calculateStats(filteredByRange),
    [filteredByRange],
  );
  const allStats = useMemo(() => calculateStats(trades), [trades]);
  const symbols = useMemo(
    () => [...new Set(trades.map((trade) => trade.symbol))].sort(),
    [trades],
  );
  const journalTrades = useMemo(
    () =>
      filteredByRange
        .filter((trade) => {
          const haystack =
            `${trade.symbol} ${trade.setup} ${trade.note}`.toLowerCase();
          const queryMatch = haystack.includes(query.toLowerCase());
          const symbolMatch =
            symbolFilter === "all" || trade.symbol === symbolFilter;
          const resultMatch =
            resultFilter === "all" ||
            (resultFilter === "win"
              ? netPnl(trade) > 0
              : resultFilter === "loss"
                ? netPnl(trade) < 0
                : netPnl(trade) === 0);
          const marketMatch =
            journalMarket === "all" || marketOf(trade) === journalMarket;
          return queryMatch && symbolMatch && resultMatch && marketMatch;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredByRange, query, symbolFilter, resultFilter, journalMarket],
  );

  const [journalPage,setJournalPage]=useState(0);
  useEffect(()=>setJournalPage(0),[query,symbolFilter,resultFilter,journalMarket,range]);
  const visibleJournalTrades=journalTrades.slice(journalPage*200,(journalPage+1)*200);
  const [journalScroll,setJournalScroll]=useState(0);
  const journalViewport=useRef<HTMLDivElement>(null),journalFrame=useRef<number|null>(null);
  const journalRange=JournalWindow.range(journalTrades.length,Math.max(0,journalScroll-40),560,48);
  const desktopJournalTrades=journalTrades.length>1000?journalTrades.slice(journalRange.start,journalRange.end):visibleJournalTrades;
  useEffect(()=>{setJournalScroll(0);if(journalViewport.current)journalViewport.current.scrollTop=0;},[query,symbolFilter,resultFilter,journalMarket,range]);
  const tradesById = useMemo(
    () => new Map(trades.map((trade) => [trade.id, trade])),
    [trades],
  );
  const imagesByTrade = useMemo(() => {
    const grouped = new Map<string, TradeImage[]>();
    for (const image of tradeImages) {
      const current = grouped.get(image.tradeId) ?? [];
      current.push(image);
      grouped.set(image.tradeId, current);
    }
    return grouped;
  }, [tradeImages]);
  const recentTradeImages = useMemo(
    () =>
      tradeImages.filter((image) => tradesById.has(image.tradeId)).slice(0, 6),
    [tradeImages, tradesById],
  );
  const activeImageTrade = activeImage
    ? tradesById.get(activeImage.tradeId)
    : undefined;
  const activeImageSiblings = activeImage
    ? (imagesByTrade.get(activeImage.tradeId) ?? [])
    : [];
  const latestTradeId = useMemo(
    () => [...trades].sort((a, b) => b.date.localeCompare(a.date))[0]?.id ?? "",
    [trades],
  );
  const effectiveImageTradeId =
    imageTradeId && tradesById.has(imageTradeId) ? imageTradeId : latestTradeId;

  async function loadConnections(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/connections", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { connections?: Connection[] };
      if (signal?.aborted) return;
      setConnections(payload.connections ?? []);
    } catch {
      /* connections stay empty in device-only preview */
    }
  }

  async function loadTradeImages(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/trade-images", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { images?: TradeImage[] };
      if (signal?.aborted) return;
      setTradeImages(payload.images ?? []);
    } catch {
      /* image gallery remains available after cloud reconnect */
    }
  }

  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    if (window.location.hash !== `#${next}`)
      window.history.pushState(
        null,
        "",
        window.location.pathname + window.location.search + `#${next}`,
      );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openTradeModal = () => {
    if (draftRestored) {
      setModalOpen(true);
      setToast("Đã khôi phục nháp chưa lưu trên thiết bị.");
      return;
    }
    setEditingTradeId(null);
    setDraft(makeDraft());
    setAssetInput(JournalForm.blank('COMMODITY_FUTURES','VND'));
    setDraftImages([]);
    setModalOpen(true);
  };

  const openEditTradeModal = (trade: Trade) => {
    if (isDemo) {
      setToast("Hãy bắt đầu nhật ký thật trước khi chỉnh sửa giao dịch.");
      return;
    }
    setEditingTradeId(trade.id);
    editBaseline.current=UnifiedJournal.stable(trade);
    setDraft(makeDraftFromTrade(trade));
    setAssetInput(JournalForm.load(trade,'VND'));
    setDraftImages([]);
    setModalOpen(true);
  };

  const assetPreview=JournalForm.preview({...assetInput,id:editingTradeId||'form-preview',date:draft.date,origin:'USER_LIVE',symbol:draft.symbol,direction:draft.side==='Sell'?'SHORT':'LONG',quantity:draft.quantity,entry_price:draft.entryPrice,exit_price:draft.exitPrice,stop_loss:draft.stopLoss,initial_1r_money:draft.risk,net_pnl:assetInput.reported_net_verified?(Number(draft.pnl)-(Number(assetInput.fees)+Number(assetInput.taxes)+Number(assetInput.swap_cost))*(Number(assetInput.fx_rate)||(assetInput.quote_ccy==='VND'?1:NaN))):'',account_ccy:'VND'});
  const changeAsset=(next:Record<string,any>)=>{setAssetInput(next);setDraft(prior=>({...prior,market:JournalForm.profiles[next.asset_class].classic as Market}));};
  const selectDraftImages = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    const valid = picked.filter(
      (file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
        file.size <= 6 * 1024 * 1024,
    );
    if (valid.length !== picked.length)
      setToast("Chỉ nhận JPG, PNG, WEBP tối đa 6 MB/ảnh.");
    setDraftImages((current) => [...current, ...valid].slice(0, 4));
    if (valid.length) setDraft((current) => ({ ...current, screenshot: true }));
  };

  const uploadTradeImages = async (tradeId: string, files: File[]) => {
    const uploaded: TradeImage[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set("tradeId", tradeId);
      formData.set("file", file);
      const response = await fetch("/api/trade-images", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        image?: TradeImage;
        error?: string;
      };
      if (!response.ok || !payload.image)
        throw new Error(payload.error ?? "Không thể lưu hình ảnh");
      uploaded.push(payload.image);
    }
    if (uploaded.length)
      setTradeImages((current) => [...uploaded.reverse(), ...current]);
    return uploaded.length;
  };

  const quickUploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])].slice(0, 4);
    event.target.value = "";
    if (!files.length) return;
    if (isDemo) {
      setToast("Hãy bắt đầu nhật ký thật trước khi lưu hình ảnh.");
      return;
    }
    if (dataMode !== "cloud") {
      setToast(
        "Lưu ảnh riêng tư lên cloud hiện không khả dụng; giao dịch và ghi chú vẫn được lưu trên thiết bị này.",
      );
      return;
    }
    if (!effectiveImageTradeId) {
      setToast("Hãy chọn giao dịch cần gắn ảnh.");
      return;
    }
    setImageUploading(true);
    try {
      const count = await uploadTradeImages(effectiveImageTradeId, files);
      setToast(`Đã gắn ${count} ảnh vào giao dịch.`);
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Không thể tải hình ảnh.",
      );
    } finally {
      setImageUploading(false);
    }
  };

  const deleteTradeImage = async (image: TradeImage) => {
    if (!window.confirm("Xóa hình ảnh này khỏi nhật ký?")) return;
    try {
      await safetyBackup();
      const response = await fetch(
        `/api/trade-images?id=${encodeURIComponent(image.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Không thể xóa hình ảnh");
      setTradeImages((current) =>
        current.filter((item) => item.id !== image.id),
      );
      setActiveImage(null);
      setToast("Đã xóa hình ảnh.");
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Không thể xóa hình ảnh.",
      );
    }
  };

  const binanceToTrade = (item: BinanceImportedTrade): Trade => ({
    id: crypto.randomUUID(),
    date: item.date,
    symbol: item.symbol,
    side: item.side,
    session: item.session,
    setup: item.setup,
    timeframe: item.timeframe,
    risk: item.risk,
    riskKnown: item.riskKnown,
    feesKnown: item.feesKnown,
    openedAt: item.openedAt,
    closedAt: item.closedAt,
    pnl: item.pnl,
    discipline: item.discipline,
    psychology: item.psychology,
    note: item.note,
    durationMin: item.durationMin,
    market: item.market,
    source: item.source,
    quantity: item.quantity,
    entryPrice: item.entryPrice,
    exitPrice: item.exitPrice,
    fees: item.fees,
    externalId: item.externalId,
  });
  const prepareTradeImport = async (event: ChangeEvent<HTMLInputElement>|File,separator?:"."|",") => {
    const file = event instanceof File?event:event.target.files?.[0];
    if(!(event instanceof File))event.target.value = "";
    importFileV33.current=file||null;setNumberChoice(separator||"");
    if (!file) return;
    setTradeImportPreview(null);
    setTradeImportBusy(true);
    try {
      const extension = file.name.toLowerCase().split(".").pop();
      const isPdf = extension === "pdf" || file.type === "application/pdf";
      let result: { trades: Trade[]; errors: string[]; detected: number;numberDecisions?:TradeImportPreview["numberDecisions"];needsNumberConfirmation?:boolean };
      if (isPdf) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const document = await pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
        }).promise;
        let text = "";
        for (
          let pageNumber = 1;
          pageNumber <= document.numPages;
          pageNumber += 1
        ) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          text += `${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}\n`;
        }
        const parsed = parseBinanceFuturesText(text);
        result = { ...parsed, trades: parsed.trades.map(binanceToTrade) };
      } else if (extension === "csv") {
        result = parseTradeCsv(await file.text(), "CSV",separator);
      } else if (["xlsx", "xls", "xlsm"].includes(extension ?? "")) {
        result = await parseTradeWorkbook(file,separator);
      } else {
        throw new Error(
          "Định dạng chưa hỗ trợ. Hãy chọn PDF Binance Futures, Excel hoặc CSV.",
        );
      }
      if (!result.detected && !result.trades.length)
        throw new Error(
          result.errors[0] ?? "Không tìm thấy giao dịch trong file.",
        );
      const fileHash = await sha256(new Uint8Array(await file.arrayBuffer()));
      const identified = await identifyTrades(result.trades.map((t,i)=>({...t,id:t.externalId&&!t.externalId.startsWith('import-')?t.id:`file:${fileHash}:${i}`,rawPayloadJson:JSON.stringify(t)})),accountId);
      importRaw.current = identified;
      setImportCurrency(isPdf || /binance/i.test(file.name) || result.trades.some(t=>/binance/i.test(t.source||"")) ? "USDT" : "VND");
      setImportFx("");
      setImportAccount("");
      setImportBroker("");
      const plan = await planIngestion(
        isDemo ? [] : trades,
        identified,
        accountId,
      );
      setIngestionPlan(plan);
      setResolutions({});
      setTradeImportPreview({
        fileName: file.name,
        detected: result.detected,
        trades: identified,
        errors: result.errors,
        numberDecisions:result.numberDecisions,needsNumberConfirmation:result.needsNumberConfirmation,
      });
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Không đọc được file nhật ký.",
      );
    } finally {
      setTradeImportBusy(false);
    }
  };
  const changeImportFx = async (currency: string, fx: string) => {
    setImportCurrency(currency);
    setImportFx(fx);
    if (!tradeImportPreview) return;
    const rate = currency === "VND" ? 1 : Number(fx);
    if (!(rate > 0)) return;
    const incoming = importRaw.current.map((t) => ({
      ...t,
      pnl: t.pnl * rate,
      fees: (t.fees ?? 0) * rate,
      risk: t.risk * rate,
      accountId: importAccount || t.accountId,
      ...(importBroker ? { source: importBroker } : {}),
      rawPayloadJson: JSON.stringify({
        original: t.rawPayloadJson ?? t,
        conversion: { currency, rateToVND: rate },
      }),
    }));
    setTradeImportPreview({ ...tradeImportPreview, trades: incoming });
    setIngestionPlan(
      await planIngestion(isDemo ? [] : trades, incoming, accountId),
    );
    setResolutions({});
  };
  const setImportScope = async (account: string, broker: string) => {
    setImportAccount(account);
    setImportBroker(broker);
    if (!tradeImportPreview) return;
    const incoming = tradeImportPreview.trades.map((t) => ({
      ...t,
      accountId: account || null,
      ...(broker ? { source: broker } : {}),
    }));
    setTradeImportPreview({ ...tradeImportPreview, trades: incoming });
    setIngestionPlan(
      await planIngestion(isDemo ? [] : trades, incoming, accountId),
    );
    setResolutions({});
  };
  const commitTradeImport = async () => {
    if (!tradeImportPreview || !ingestionPlan) return;
    if (importCurrency !== "VND" && !(Number(importFx) > 0)) {
      setToast("Nhập tỷ giá về VNĐ trước khi lưu file tiền ngoại tệ.");
      return;
    }
    const undecided = ingestionPlan.candidates.filter(
      (c) => !resolutions[c.incoming.id],
    );
    if (undecided.length) {
      setToast("Chọn cách xử lý từng cặp nghi trùng trước khi nhập.");
      return;
    }
    setTradeImportBusy(true);
    try {
      const skipped = new Set(
        ingestionPlan.candidates
          .filter((c) => resolutions[c.incoming.id] === "skip")
          .map((c) => c.incoming.id),
      );
      const enrich = new Map(
        ingestionPlan.candidates
          .filter((c) => resolutions[c.incoming.id] === "enrich")
          .map((c) => [c.incoming.id, c.existing]),
      );
      const selected: Trade[] = ingestionPlan.additions
        .filter((t) => !skipped.has(t.id))
        .map((t) => {
          const old = enrich.get(t.id);
          return old
            ? {
                ...old,
                ...t,
                id: old.id,
                externalId: old.externalId,
                accountId: old.accountId,
                source: old.source,
                note: old.note,
                rules: old.rules,
                setup: old.setup,
                psychology: old.psychology,
                discipline: old.discipline,
              }
            : t;
        });
      // Exact identity receipts enrich only financial facts; user-authored notes/checklists remain.
      for (const d of ingestionPlan.duplicates)
        selected.push({
          ...d.existing,
          pnl: d.incoming.pnl,
          fees: d.incoming.fees,
          quantity: d.incoming.quantity,
          exitPrice: d.incoming.exitPrice,
        });
      let accepted: Trade[] = selected;
      let receipt: import("@/lib/governance-report").AuditReceipt = {
        source: tradeImportPreview.fileName,
        scanned: tradeImportPreview.detected,
        imported: ingestionPlan.additions.length - skipped.size,
        duplicates: ingestionPlan.duplicates.length,
        errors: tradeImportPreview.errors,
        hashes: selected.flatMap((t) => (t.dedupHash ? [t.dedupHash] : [])),
        decisions: ingestionPlan.candidates.map((c) => ({
          incoming: c.incoming.id,
          existing: c.existing.id,
          resolution: resolutions[c.incoming.id],
        })),
      };
      const progressRows=new Map((isDemo?[]:trades).map(t=>[t.id,t]));
      if (dataMode === "cloud" && selected.length) {
        const summary=await saveTradeBatches(selected,accountId,async(rows,done)=>{for(const t of rows)progressRows.set(t.id,t);await saveLocal('import-progress:'+accountId,{file:tradeImportPreview.fileName,done,total:selected.length,receipt:rows});if(done%5000===0||done===selected.length){await persistClassicLedger(tradesStorageKey,[...progressRows.values()]);setTrades([...progressRows.values()]);setIsDemo(false);}if(done%5000===0||done===selected.length)setToast(`Đã lưu ${done}/${selected.length} dòng; các lô đã hoàn tất được giữ nếu gián đoạn.`);});
        accepted=[...progressRows.values()];receipt={...receipt,...summary};setLocalFallback(false);
      }
      const base = isDemo ? [] : trades;
      const merged = new Map(base.map((t) => [t.id, t]));
      for (const t of accepted) merged.set(t.id, t);
      const next = [...merged.values()];
      await persistClassicLedger(tradesStorageKey,next,{history:true,before:trades});
      await saveLocal("ledger:" + accountId, next);
      setTrades(next);
      setIsDemo(false);
      window.localStorage.setItem(demoStorageKey, "false");
      setLastReceipt(receipt);
      setTradeImportPreview(null);
      setIngestionPlan(null);
      setToast(
        `Đã lưu nhật ký · ${receipt.imported ?? 0} mới · ${receipt.duplicates ?? 0} trùng ID. Các lô có thể nhập lại an toàn.`,
      );
      if(next.length<=5000)await exportGovernance("xlsx", receipt, next);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Không thể lưu lô nhập.");
    } finally {
      setTradeImportBusy(false);
    }
  };
  const saveTrade = async (event: FormEvent) => {
    if(editingTradeId&&editBaseline.current&&editBaseline.current!==UnifiedJournal.stable(trades.find(t=>t.id===editingTradeId))){event.preventDefault();setToast('Lệnh đã thay đổi ở giao diện khác; bản nhập của bạn được giữ trong form. Hãy đối chiếu trước khi lưu.');return;}
    event.preventDefault();
    const risk = Number(draft.risk);
    const pnl = Number(draft.pnl);
    if (
      !draft.date ||
      !draft.symbol.trim() ||
      draft.setup === UNCLASSIFIED_SETUP ||
      (!assetInput.enabled&&(!Number.isFinite(risk)||risk<=0||!Number.isFinite(pnl)))
    ) {
      setToast("Vui lòng nhập ngày, sản phẩm, setup, rủi ro và P&L trước phí.");
      return;
    }
    const checks = [
      draft.plan,
      draft.noFomo,
      draft.noRevenge,
      draft.screenshot,
    ];
    const existing = editingTradeId
      ? trades.find((item) => item.id === editingTradeId)
      : undefined;
    let trade: Trade = {
      ...existing,
      id: existing?.id ?? `T${Date.now()}`,
      date: draft.date,
      symbol: draft.symbol.trim().toUpperCase(),
      side: draft.side,
      session: draft.session,
      setup: draft.setup,
      timeframe: draft.timeframe,
      risk,
      pnl,
      discipline: Math.round(
        (checks.filter(Boolean).length / checks.length) * 100,
      ),
      psychology: draft.psychology,
      note: draft.note,
      durationMin: Number(draft.durationMin) || 0,
      market: draft.market,
      source: draft.source,
      fees: Number(draft.fees) || 0,
      feesKnown: draft.fees.trim() !== "",
      riskKnown: risk > 0,
      quantity: Number(draft.quantity) || 0,
      entryPrice: Number(draft.entryPrice) || 0,
      stopLoss: Number(draft.stopLoss) || 0,
      takeProfit: Number(draft.takeProfit) || 0,
      exitPrice: Number(draft.exitPrice) || 0,
      version: existing?.version,
      rules: {
        plan: draft.plan,
        noFomo: draft.noFomo,
        noRevenge: draft.noRevenge,
        screenshot: draft.screenshot,
      },
      rulesJson: JSON.stringify({
        plan: draft.plan,
        noFomo: draft.noFomo,
        noRevenge: draft.noRevenge,
        screenshot: draft.screenshot,
      }),
      mae: draft.mae ?? null,
      mfe: draft.mfe ?? null,
      externalId: existing?.externalId,
      accountId: existing?.accountId,
    };
    if(assetInput.enabled){try{const approved=JournalForm.requireReady(assetPreview);const n=JournalForm.requireReady(JournalForm.preview({...approved.raw,id:trade.id}));trade=JournalForm.toClassic(n,trade) as Trade;}catch(e){setToast(e instanceof Error?e.message:String(e));return;}}
    const imagesToUpload = [...draftImages];
    if (imagesToUpload.length)
      await saveLocal("evidence:" + accountId + ":" + trade.id, imagesToUpload);
    const next = existing
      ? trades.map((item) => (item.id === trade.id ? trade : item))
      : isDemo
        ? [trade]
        : [...trades, trade];
    try{await persistClassicLedger(tradesStorageKey,next,{history:true,before:trades});}catch(e){setToast(e instanceof Error?e.message:'Chưa lưu được nhật ký; giữ nguyên form để đối chiếu.');return;}
    setTrades(next);
    setIsDemo(false);
    window.localStorage.setItem(demoStorageKey, "false");
    setModalOpen(false);
    setEditingTradeId(null);
    setDraftImages([]);
    setDraftRestored(false);
    void removeLocal("draft:" + accountId);
    setImageTradeId(trade.id);
    if (dataMode === "cloud") {
      try {
        await queueMutation({
          owner: accountId,
          method: existing ? "PATCH" : "POST",
          url: "/api/trades",
          body: { trade },
        });
        await flushQueue(accountId, refreshQueue);
        refreshQueue();
        const pending = await listQueue(accountId);
        if (pending.length) {
          setToast("Đã lưu trên thiết bị; có mục chờ đồng bộ / đối soát.");
          return;
        }
        const fresh = await fetchAllTrades({ headers: { "X-Journal-Owner": accountId } });
        if (fresh.ok) {
          const data = (await fresh.json()) as { trades: Trade[] };
          setTrades(data.trades);
          void persistClassicLedger(tradesStorageKey, data.trades).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
        }
        const imageCount = imagesToUpload.length
          ? await uploadTradeImages(trade.id, imagesToUpload)
          : 0;
        if (imageCount)
          void removeLocal("evidence:" + accountId + ":" + trade.id);
        setToast(
          imageCount
            ? `Đã lưu giao dịch và ${imageCount} hình ảnh.`
            : "Đã lưu và đồng bộ giao dịch.",
        );
      } catch {
        setToast(
          "Đã lưu trên thiết bị; kiểm tra hàng đợi và ảnh chưa đồng bộ.",
        );
      }
    } else {
      setToast(
        imagesToUpload.length
          ? "Đã lưu lệnh trên thiết bị; ảnh chưa được đồng bộ."
          : existing
            ? "Đã cập nhật giao dịch."
            : "Đã lưu giao dịch mới.",
      );
    }
  };

  const saveInlineTrade=async(id:string,field:'symbol'|'setup',input:string,baseline:string)=>{const current=trades.find(t=>t.id===id),value=field==='symbol'?input.trim().toUpperCase():input.trim();if(!current||current[field]!==baseline)throw Error('Lệnh đã đổi ở nơi khác; giữ bản nhập để đối chiếu');if(!value)throw Error('Không để trống giá trị');let edited={...current,[field]:value};if(current.normalized&&field==='symbol')edited={...JournalForm.invalidate(edited,field),riskKnown:false,pnlKnown:false,feesKnown:false,unifiedV6:{...edited.unifiedV6,is_1r_verified:false,is_net_pnl_verified:false}};const next=trades.map(t=>t.id===id?edited:t);await persistClassicLedger(tradesStorageKey,next,{history:true,before:trades});setTrades(next);if(dataMode==='cloud'){await queueMutation({owner:accountId,method:'PATCH',url:'/api/trades',body:{trade:{...edited,version:current.version}}});await flushQueue(accountId,refreshQueue);}setToast('Đã lưu ô nhật ký');};
  const currentJournal=useRef({accountId,trades,notes,riskSettings});
  currentJournal.current={accountId,trades,notes,riskSettings};
  const safetyBackup=async()=>{
    const before=JSON.stringify(currentJournal.current),prepared=await JournalLifecycle.prepare({classic:{trades:JournalLifecycle.tag(trades),notes,riskSettings}},accountId,dataMode==='cloud');
    if(JSON.stringify(currentJournal.current)!==before)throw Error('Nhật ký đã thay đổi trong khi sao lưu; hãy thử lại');return prepared;
  };
  const hardResetJournal=async()=>{try{const prepared=await safetyBackup();setAutoSyncEnabled(false);const result=await JournalLifecycle.hardReset(prepared,accountId,dataMode==='cloud');setTrades([]);setNotes('');setRiskSettings({...DEFAULT_RISK,cashFlows:[]});setTradeImages([]);setIsDemo(false);setLocalFallback(false);setToast(result?.cleanupErrors?.length?'Đã reset nhật ký; một số tệp cloud đang chờ dọn. Bản sao đã lưu.':'Đã reset nhật ký và khóa dữ liệu mẫu.');}catch(e){setToast(e instanceof Error?e.message:String(e));}};
  const undoJournal=async()=>{try{await safetyBackup();const history=await readLocal<unknown[]>('mutation_oplog:'+accountId)||[],result=JournalLifecycle.undo(await readClassicLedger(tradesStorageKey),history),rows=result.rows as Trade[];
    if(dataMode==='cloud'){
      const prior=new Map(trades.map(t=>[t.id,t]));
      for(const t of rows){const before=prior.get(t.id);if(before&&JSON.stringify(before)!==JSON.stringify(t)){const r=await fetch('/api/trades',{method:'PATCH',headers:{'Content-Type':'application/json','X-Journal-Owner':accountId},body:JSON.stringify({trade:{...t,version:before.version}})});if(!r.ok)throw Error('Có thay đổi đồng thời; chưa hoàn tác trên thiết bị');}else if(!before){const r=await fetch('/api/trades',{method:'PATCH',headers:{'Content-Type':'application/json','X-Journal-Owner':accountId},body:JSON.stringify({trade:t,restore:true})});if(!r.ok)throw Error('Hãy khôi phục lệnh từ Thùng rác trước để lấy đúng phiên bản');}}
      for(const t of trades)if(!rows.some(x=>x.id===t.id)){const r=await fetch('/api/trades?id='+encodeURIComponent(t.id)+'&version='+t.version,{method:'DELETE',headers:{'X-Journal-Owner':accountId}});if(!r.ok)throw Error('Có thay đổi đồng thời; chưa hoàn tác trên thiết bị');}
    }
    await persistClassicLedger(tradesStorageKey,rows);await saveLocal('mutation_oplog:'+accountId,result.history);setTrades(rows);setToast('Đã hoàn tác');
  }catch(e){setToast(e instanceof Error?e.message:String(e));}};
  const deleteTrade = async (id: string) => {
    const trade = trades.find((item) => item.id === id);
    if (
      !window.confirm(
        `Chuyển giao dịch ${trade?.symbol ?? "này"} vào thùng rác? Có thể khôi phục trong 30 ngày.`,
      )
    )
      return;
    try{await safetyBackup();}catch(e){setToast(String(e));return;}
    await saveLocal("trash:" + accountId + ":" + id, {
      trade,
      deletedAt: new Date().toISOString(),
    });
    const next = trades.filter((trade) => trade.id !== id);
    setTrades(next);
    setTradeImages((current) =>
      current.filter((image) => image.tradeId !== id),
    );
    void persistClassicLedger(tradesStorageKey, next,{history:true,before:trades}).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
    setToast("Đã xóa giao dịch.");
    if (dataMode === "cloud") {
      await queueMutation({
        owner: accountId,
        method: "DELETE",
        url: `/api/trades?id=${encodeURIComponent(id)}`,
      });
      void flushQueue(accountId, refreshQueue);
    }
  };

  const restoreDemo = async () => {
    try{if(JournalLifecycle.read(accountId).noMock)throw Error('Đã khóa dữ liệu mẫu; dùng hồ sơ trình duyệt riêng để xem mẫu');if(trades.length||riskSettings.initialCapital>0||(riskSettings.cashFlows||[]).length||(await readLocal<unknown[]>('mutation_oplog:'+accountId)||[]).length)await safetyBackup();JournalLifecycle.set('DEMO_SANDBOX',accountId);}catch(e){setToast(String(e));return;}
    setTrades(SAMPLE_TRADES);
    setIsDemo(true);
    void persistClassicLedger(tradesStorageKey, SAMPLE_TRADES).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
    window.localStorage.setItem(demoStorageKey, "true");
    setToast(
      "Đang hiển thị dữ liệu minh họa; dữ liệu cloud không bị thay đổi.",
    );
  };

  const startRealJournal = () => {
    const keep=trades.filter(t=>t.origin!=="MOCK_SEED_V3");
    JournalLifecycle.set("CLEAN_SLATE_LOCKED",accountId);
    setTrades(keep);setIsDemo(false);
    void persistClassicLedger(tradesStorageKey,keep).catch(()=>setToast("Chưa lưu được thay đổi; bản gốc được giữ."));
    window.localStorage.setItem(demoStorageKey,"false");
    setToast("Đã bỏ dữ liệu mẫu và giữ mọi lệnh của bạn.");navigate("journal");
  };

  const clearAll = async () => {
    if (isDemo) {
      startRealJournal();
      return;
    }
    if (
      !window.confirm(
        "Xóa toàn bộ giao dịch? Hãy xuất bản sao trước nếu bạn cần khôi phục.",
      )
    )
      return;
    try{await safetyBackup();}catch(e){setToast(String(e));return;}
    await saveLocal("recovery:" + accountId + ":" + Date.now(), {trades,notes,riskSettings});
    for(const trade of trades)await saveLocal("trash:"+accountId+":"+trade.id,{trade,deletedAt:new Date().toISOString()});
    JournalLifecycle.set("CLEAN_SLATE_LOCKED",accountId);
    setTrades([]);
    setTradeImages([]);
    setIsDemo(false);
    void persistClassicLedger(tradesStorageKey,[],{history:true,before:trades}).catch(()=>setToast("Chưa lưu được thay đổi trên thiết bị."));
    window.localStorage.setItem(demoStorageKey, "false");
    setToast(
      "Đã chuyển dữ liệu khỏi nhật ký; có bản trước thao tác trên thiết bị.",
    );
    if (dataMode === "cloud") {
      await queueMutation({
        owner: accountId,
        method: "DELETE",
        url: "/api/trades?all=1",
      });
      void flushQueue(accountId, refreshQueue);
    }
  };

  const saveNotes = () => {
    window.localStorage.setItem(notesStorageKey, notes);
    setToast("Đã lưu ghi chú.");
  };

  const insertNoteTemplate = (template: (typeof NOTE_TEMPLATES)[number]) => {
    setNotes((current) =>
      current.trim()
        ? `${current.trim()}\n\n────────────────────\n\n${template.content}`
        : template.content,
    );
    setToast(`Đã chèn mẫu “${template.label}”.`);
  };

  const insertTradeReviewTemplate = () => {
    setDraft((current) => ({
      ...current,
      note: current.note.trim()
        ? `${current.note.trim()}\n\n────────────────────\n\n${TRADE_REVIEW_TEMPLATE}`
        : TRADE_REVIEW_TEMPLATE,
    }));
    setToast("Đã chèn khung review vào giao dịch.");
  };

  const exportBackup = () => {
    const payload = JSON.stringify(
      {
        format: "trading-plan-pro-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        trades:JournalLifecycle.tag(trades),
        notes,
        riskSettings,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trading-plan-pro-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Đã tạo bản sao JSON; không bao gồm khóa broker.");
  };

  const exportGovernance = async (
    kind: "xlsx" | "pdf" | "zip" = "xlsx",
    receipt = lastReceipt,
    source = trades,
  ) => {
    try {
      const report = await import("@/lib/governance-report");
      const name = report.reportName(accountId);
      let bytes: Uint8Array;
      let mime: string;
      if (kind === "pdf") {
        const font = await fetch("/fonts/BeVietnamPro-Regular.ttf");
        if (!font.ok) throw Error("Không tải được font PDF");
        bytes = await report.executivePdf(
          source,
          riskSettings,
          new Uint8Array(await font.arrayBuffer()),
        );
        mime = "application/pdf";
      } else if (kind === "zip") {
        const extras: Record<string, Uint8Array> = {};
        const metadata: Array<{
          tradeId: string;
          path: string;
          filename: string;
        }> = [];
        const local = await listLocal<File[]>("evidence:" + accountId + ":");
        for (const item of local) {
          const tradeId = item.key.slice(
            ("evidence:" + accountId + ":").length,
          );
          for (let i = 0; i < item.value.length; i++) {
            const file = item.value[i],
              path =
                "images/local_" +
                tradeId.replace(/[^a-zA-Z0-9_-]/g, "_") +
                "_" +
                i +
                ".webp";
            extras[path] = new Uint8Array(await file.arrayBuffer());
            metadata.push({ tradeId, path, filename: file.name });
          }
        }
        for (const image of tradeImages) {
          const r = await fetch(image.url);
          if (!r.ok) throw Error("Ảnh cloud chưa tải được: " + image.filename);
          const path =
            "images/" +
            image.id +
            "." +
            (image.contentType === "image/png"
              ? "png"
              : image.contentType === "image/webp"
                ? "webp"
                : "jpg");
          extras[path] = new Uint8Array(await r.arrayBuffer());
          metadata.push({
            tradeId: image.tradeId,
            path,
            filename: image.filename,
          });
        }
        const { strToU8 } = await import("fflate");
        extras["images.json"] = strToU8(JSON.stringify(metadata));
        extras["connection-metadata.json"] = strToU8(
          JSON.stringify(connections),
        );
        bytes = report.backupArchive(source, riskSettings, notes, extras);
        mime = "application/zip";
      } else {
        bytes = report.workbookBytes(
          report.buildGovernanceWorkbook(source, riskSettings, receipt),
        );
        mime =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }
      await saveLocal("report:" + accountId + ":" + new Date().toISOString(), {
        name: name + "." + kind,
        bytes: Array.from(bytes),
      });
      report.downloadBytes(bytes, name + "." + kind, mime);
      setToast("Đã tạo báo cáo và lưu bản sao trên thiết bị.");
      return true;
    } catch (error) {
      setToast(
        "Giao dịch đã lưu; báo cáo chưa tạo được: " +
          (error instanceof Error ? error.message : "Hãy thử lại."),
      );
    }
  };

  useEffect(() => {
    if (
      persistenceOwner !== accountId ||
      isDemo ||
      !trades.length ||
      riskSettings.weeklyAutoPack === false
    )
      return;
    const check = async () => {
      const now = new Date();
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: riskSettings.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: riskSettings.timezone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
      );
      if (new Date(date + "T12:00:00Z").getUTCDay() !== 0 || hour < 22) return;
      const key = "weekly-report:" + accountId + ":" + date;
      if (await readLocal(key)) return;
      const ok = await exportGovernance("xlsx");
      if (ok) await saveLocal(key, true);
    };
    void check();
    const timer = setInterval(() => void check(), 60000);
    return () => clearInterval(timer);
  }, [
    accountId,
    persistenceOwner,
    isDemo,
    trades.length,
    riskSettings.weeklyAutoPack,
    riskSettings.timezone,
  ]);

  const exportTradeHistory = async () =>
    exportGovernance("xlsx", lastReceipt, journalTrades);

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      let text = await file.text();
      let files: Record<string, Uint8Array> | undefined;
      if (file.name.toLowerCase().endsWith(".zip")) {
        if (file.size > 50 * 1024 * 1024) throw Error("Bản sao ZIP vượt 50MB.");
        const { unzipSync, strFromU8 } = await import("fflate");
        files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
          filter: (f) =>
            f.originalSize <= 8 * 1024 * 1024 &&
            !f.name.includes("..") &&
            !f.name.startsWith("/"),
        });
        if (!files["workspace.json"]) throw Error("ZIP thiếu workspace.json");
        text = strFromU8(files["workspace.json"]);
      }
      const parsed = JSON.parse(text) as
        | { trades?: Trade[]; notes?: string; riskSettings?: RiskSettings }
        | Trade[];
      const restored=(parsed as {format?:string;views?:{classic?:{trades?:Trade[];notes?:string;riskSettings?:RiskSettings}}}).format==='tuannhatky-safety-backup'?(parsed as {views:{classic:{trades?:Trade[];notes?:string;riskSettings?:RiskSettings}}}).views.classic:parsed;
      const incoming = Array.isArray(restored) ? restored : restored?.trades;
      if (
        !Array.isArray(incoming) ||
        !incoming.length ||
        incoming.some(
          (t) => !t?.id || !t?.symbol || !t.date || !Number.isFinite(t.pnl),
        )
      )
        throw Error("Bản sao thiếu dữ liệu giao dịch hợp lệ.");
      await saveLocal("recovery:" + accountId + ":" + Date.now(), {
        trades,
        notes,
        riskSettings,
      });
      if (restored && !Array.isArray(restored)) {
        if (typeof restored.notes === "string") {
          setNotes((current) =>
            current.trim() && current !== restored.notes
              ? current + "\n\n--- Ghi chú khôi phục ---\n" + restored.notes
              : restored.notes!,
          );
        }
        if (restored.riskSettings)
          await saveLocal("restored-risk:" + accountId, restored.riskSettings);
      }
      if (files?.["images.json"]) {
        const { strFromU8 } = await import("fflate");
        const images = JSON.parse(strFromU8(files["images.json"])) as Array<{
          tradeId: string;
          path: string;
          filename: string;
        }>;
        const grouped = new Map<string, File[]>();
        for (const image of images) {
          if (!image.path.startsWith("images/") || !files[image.path]) continue;
          const mime = image.path.endsWith(".png")
            ? "image/png"
            : image.path.endsWith(".webp")
              ? "image/webp"
              : "image/jpeg";
          grouped.set(image.tradeId, [
            ...(grouped.get(image.tradeId) ?? []),
            new File(
              [files[image.path] as Uint8Array<ArrayBuffer>],
              image.filename,
              { type: mime },
            ),
          ]);
        }
        for (const [id, images] of grouped)
          await saveLocal("evidence:" + accountId + ":" + id, images);
      }
      const plan = await planIngestion(
        isDemo ? [] : trades,
        incoming,
        accountId,
      );
      setIngestionPlan(plan);
      setResolutions({});
      setTradeImportPreview({
        fileName: file.name,
        detected: incoming.length,
        trades: incoming,
        errors: [],
      });
      navigate("journal");
      setToast(
        "Đã giữ bản trước khôi phục. Kiểm tra lô và chọn cách xử lý trước khi nhập.",
      );
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Không thể đọc bản sao.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const openConnection = (provider: Provider) => {
    if (dataMode !== "cloud") {
      setToast(
        "Kết nối broker tự động cần kho cloud riêng. Bạn có thể nhập PDF, Excel hoặc CSV trực tiếp trong Nhật ký.",
      );
      return;
    }
    setWebhookToken("");
    const existing = connections.find(
      (connection) => connection.provider === provider,
    );
    const nextDraft = makeConnectionDraft(provider);
    if (existing) {
      nextDraft.label = existing.label;
      nextDraft.accountType =
        isBridgeProvider(provider) &&
        !["push", "pull"].includes(existing.accountType)
          ? "pull"
          : existing.accountType;
    }
    setConnectionDraft(nextDraft);
    setConnectProvider(provider);
  };

  const copyWebhookToken = async () => {
    if (!webhookToken) return;
    try {
      await navigator.clipboard.writeText(webhookToken);
      setToast("Đã sao chép webhook token.");
    } catch {
      setToast("Không thể sao chép tự động; hãy chọn và sao chép token.");
    }
  };

  const saveConnection = async (event: FormEvent) => {
    event.preventDefault();
    if (!connectProvider) return;
    if (connectProvider === "tradingview" || connectProvider === "vn-broker") {
      setConnectProvider(null);
      return;
    }
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...connectionDraft,
          provider: connectProvider,
          symbols: connectionDraft.symbols
            .split(",")
            .map((symbol) => symbol.trim())
            .filter(Boolean),
          fxRate: Number(connectionDraft.fxRate),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        webhookToken?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Không thể lưu kết nối");
      await loadConnections();
      setDataMode("cloud");
      const tokenConnection =
        connectProvider === "webhook" ||
        (isBridgeProvider(connectProvider) &&
          connectionDraft.accountType === "push");
      if (tokenConnection) {
        if (!payload.webhookToken)
          throw new Error("Máy chủ chưa trả về token bảo mật.");
        setWebhookToken(payload.webhookToken);
        setToast(
          `Đã tạo khóa ${BROKERS.find((broker) => broker.provider === connectProvider)?.name ?? "bridge"}. Token chỉ hiển thị lần này.`,
        );
      } else {
        setConnectProvider(null);
        setToast("Đã lưu kết nối an toàn. Khóa bridge/API được mã hóa.");
      }
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Không thể lưu kết nối.",
      );
    }
  };

  const mergeSyncedTrades = (incoming: Trade[]) => {
    if (!incoming.length) return;
    setTrades((current) => {
      const base = isDemoDataset(current) ? [] : current;
      const merged = new Map(
        base.map((trade) => [
          `${trade.source ?? ""}:${trade.externalId ?? trade.id}`,
          trade,
        ]),
      );
      for (const trade of incoming) {
        const key = `${trade.source ?? ""}:${trade.externalId ?? trade.id}`;
        merged.set(key, trade);
      }
      const next = [...merged.values()];
      void persistClassicLedger(tradesStorageKey, next,{history:true,before:trades}).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
      return next;
    });
    setIsDemo(false);
    window.localStorage.setItem(demoStorageKey, "false");
  };

  const performConnectionSync = async (connection: Connection) => {
    const response = await fetch("/api/connections/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: connection.id }),
    });
    const payload = (await response.json()) as {
      error?: string;
      imported?: number;
      trades?: Trade[];
    };
    if (!response.ok) throw new Error(payload.error ?? "Đồng bộ thất bại");
    mergeSyncedTrades(payload.trades ?? []);
    const receipt = {
      ...payload,
      source: connection.label,
    } as import("@/lib/governance-report").AuditReceipt;
    setLastReceipt(receipt);
    const current = isDemo ? [] : trades;
    const next = new Map(current.map((t) => [t.id, t]));
    for (const t of payload.trades ?? []) next.set(t.id, t);
    await exportGovernance("xlsx", receipt, [...next.values()]);
    return payload.imported ?? 0;
  };

  const syncConnection = async (connection: Connection) => {
    setSyncingId(connection.id);
    try {
      const imported = await performConnectionSync(connection);
      await loadConnections();
      setAutoSyncStatus(
        `Đồng bộ gần nhất lúc ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`,
      );
      setToast(`Đã nhập ${imported} giao dịch mới.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Đồng bộ thất bại.");
    } finally {
      setSyncingId(null);
    }
  };

  const syncAllConnections = async (silent = false, staleOnly = false) => {
    if (syncAllLock.current) return;
    const eligible = connections.filter(isAutoSyncConnection);
    const targets = staleOnly
      ? eligible.filter(
          (connection) =>
            !connection.lastSyncAt ||
            Date.now() - new Date(connection.lastSyncAt).getTime() >=
              15 * 60 * 1000,
        )
      : eligible;
    if (!targets.length) {
      if (eligible.length)
        setAutoSyncStatus("Dữ liệu đã được kiểm tra trong 15 phút gần nhất");
      return;
    }
    syncAllLock.current = true;
    setAutoSyncing(true);
    setAutoSyncStatus(`Đang kiểm tra ${targets.length} kết nối…`);
    let imported = 0;
    const errors: string[] = [];
    try {
      for (const connection of targets) {
        try {
          imported += await performConnectionSync(connection);
        } catch (error) {
          errors.push(
            `${connection.label}: ${error instanceof Error ? error.message : "lỗi đồng bộ"}`,
          );
        }
      }
      await loadConnections();
      const time = new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
      setAutoSyncStatus(
        errors.length
          ? `Hoàn tất ${time} · ${errors.length} kết nối cần kiểm tra`
          : `Hoàn tất ${time} · ${imported} lệnh mới`,
      );
      if (!silent)
        setToast(
          errors.length
            ? errors[0]
            : `Đã đồng bộ tất cả, thêm ${imported} giao dịch.`,
        );
    } finally {
      setAutoSyncing(false);
      syncAllLock.current = false;
    }
  };

  const disconnect = async (connection: Connection) => {
    if (
      !window.confirm(
        `Ngắt kết nối ${connection.label}? Dữ liệu giao dịch đã nhập vẫn được giữ lại.`,
      )
    )
      return;
    try {
      const response = await fetch(
        `/api/connections?id=${encodeURIComponent(connection.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Không thể ngắt kết nối");
      await loadConnections();
      setToast("Đã ngắt kết nối broker.");
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Không thể ngắt kết nối.",
      );
    }
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    const brokerName = event.target.dataset.broker ?? "CSV";
    const source: Trade[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const text = await file.text();
      const parsed = parseTradeCsv(text, brokerName);
      const hash = await sha256(text);
      source.push(
        ...parsed.trades.map((t, i) => ({
          ...t,
          id: `file:${hash}:${i}`,
          source: brokerName,
        })),
      );
      errors.push(...parsed.errors);
    }
    importRaw.current = source;
    setImportCurrency("VND");
    setImportFx("");
    const plan = await planIngestion(isDemo ? [] : trades, source, accountId);
    setIngestionPlan(plan);
    setResolutions({});
    setTradeImportPreview({
      fileName: files.map((f) => f.name).join(", "),
      detected: source.length + errors.length,
      trades: source,
      errors,
    });
    navigate("journal");
  };

  useEffect(() => {
    syncAllConnectionsRef.current = syncAllConnections;
  });

  useEffect(() => {
    if (
      !autoSyncEnabled ||
      dataMode !== "cloud" ||
      !connections.some(isAutoSyncConnection)
    )
      return;
    const initial = window.setTimeout(() => {
      void syncAllConnectionsRef.current(true, true);
    }, 800);
    const interval = window.setInterval(
      () => {
        void syncAllConnectionsRef.current(true);
      },
      15 * 60 * 1000,
    );
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [autoSyncEnabled, dataMode, connections]);

  const renderJournal = () => (
    <>
      <section className="quote-strip">
        <div>
          <span>NGUYÊN TẮC CỐT LÕI</span>
          <strong>
            “Giao dịch tốt không phải lệnh thắng — mà là lệnh đúng kế hoạch.”
          </strong>
        </div>
        <div className="quote-actions">
          <button
            type="button"
            className="ghost-button excel-button"
            onClick={exportTradeHistory}
            disabled={!journalTrades.length}
            title={`Xuất báo cáo chi tiết cho ${journalTrades.length} giao dịch đang hiển thị`}
          >
            <FileSpreadsheet size={16} /> Xuất báo cáo Excel
          </button>
          <label
            className="gold-button compact file-button"
            title="Nhập giao dịch từ PDF Binance Futures, Excel hoặc CSV"
          >
            <FileUp size={16} />{" "}
            {tradeImportBusy ? "Đang đọc…" : "Nhập file nhật ký"}
            <input
              type="file"
              accept="application/pdf,.pdf,.xlsx,.xls,.xlsm,.csv,text/csv"
              onChange={(event) => {
                void prepareTradeImport(event);
              }}
              disabled={tradeImportBusy}
            />
          </label>
          <button
            type="button"
            className="gold-button compact"
            onClick={openTradeModal}
          >
            <Plus size={17} /> Thêm giao dịch
          </button>
        </div>
      </section>
      <p className="journal-import-hint">
        PDF: lịch sử vị thế Binance Futures. Excel/CSV: cột Ngày, Sản phẩm hoặc
        Symbol, Lệnh, Lãi/Lỗ hoặc P&amp;L. Dữ liệu được đọc ngay trên trình
        duyệt và xem trước trước khi lưu.
      </p>
      <section
        className="journal-media-panel"
        aria-labelledby="journal-media-title"
      >
        <div className="journal-media-head">
          <div className="journal-media-title">
            <span className="journal-media-icon">
              <Images size={19} />
            </span>
            <div>
              <span className="eyebrow">HÌNH ẢNH GIAO DỊCH</span>
              <h2 id="journal-media-title">Cập nhật biểu đồ vào từng lệnh</h2>
              <p>
                Chọn lệnh, tải ảnh từ điện thoại và xem lại ngay trong nhật ký.
              </p>
            </div>
          </div>
          <div className="journal-media-actions">
            <label>
              <span>Gắn vào lệnh</span><input aria-label="Tìm lệnh để gắn ảnh" placeholder="Lọc theo ngày, mã hoặc ID" value={imageTradeQuery} onChange={e=>setImageTradeQuery(e.target.value)}/>
              <select
                value={effectiveImageTradeId}
                onChange={(event) => setImageTradeId(event.target.value)}
                disabled={isDemo || !trades.length}
                aria-label="Chọn giao dịch để gắn ảnh"
              >
                <option value="">Chọn giao dịch</option>
                {[...trades].filter(t=>t.id===effectiveImageTradeId||(t.date+' '+t.symbol+' '+t.id).toLowerCase().includes(imageTradeQuery.toLowerCase()))
                  .sort((a,b)=>a.id===effectiveImageTradeId?-1:b.id===effectiveImageTradeId?1:b.date.localeCompare(a.date)).slice(0,200)
                  .map((trade) => (
                    <option value={trade.id} key={trade.id}>
                      {trade.date} · {trade.symbol} · {trade.side}
                    </option>
                  ))}
              </select>
            </label>
            <label
              className={`journal-image-upload ${isDemo || !trades.length ? "disabled" : ""}`}
              aria-disabled={isDemo || !trades.length}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={isDemo || !trades.length || imageUploading}
                onChange={quickUploadImages}
              />
              {imageUploading ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ImagePlus size={16} />
              )}
              <span>{imageUploading ? "Đang tải..." : "Tải ảnh nhanh"}</span>
            </label>
          </div>
        </div>
        {recentTradeImages.length ? (
          <div className="journal-media-grid">
            {recentTradeImages.map((image) => {
              const trade = tradesById.get(image.tradeId);
              if (!trade) return null;
              return (
                <button
                  type="button"
                  className="journal-image-card"
                  key={image.id}
                  onClick={() => setActiveImage(image)}
                  aria-label={`Xem ảnh giao dịch ${trade.symbol}`}
                >
                  <img
                    src={image.url}
                    alt={`Biểu đồ ${trade.symbol} ngày ${trade.date}`}
                    loading="lazy"
                  />
                  <span className="journal-image-shade">
                    <b>{trade.symbol}</b>
                    <small>
                      {DATE.format(new Date(`${trade.date}T12:00:00`))} ·{" "}
                      {trade.side}
                    </small>
                  </span>
                  <i>
                    <ZoomIn size={14} />
                  </i>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="journal-media-empty">
            <Camera size={24} />
            <div>
              <strong>
                {isDemo
                  ? "Ảnh chỉ lưu trong nhật ký thật"
                  : "Chưa có ảnh biểu đồ"}
              </strong>
              <p>
                {isDemo
                  ? "Bắt đầu nhật ký thật rồi tải ảnh trước/sau lệnh từ điện thoại."
                  : "Dùng nút “Tải ảnh nhanh” hoặc đính kèm khi thêm giao dịch."}
              </p>
            </div>
          </div>
        )}
      </section>
      {tradeImportPreview && (
        <section className="panel binance-preview-panel" aria-live="polite">
          <div className="panel-title">
            <div>
              <span className="eyebrow">XEM TRƯỚC GIAO DỊCH</span>
              <h3>{tradeImportPreview.fileName}</h3>
            </div>
            <span className="status-chip">
              {tradeImportPreview.detected} dòng nhận diện
            </span>
          </div>
          {tradeImportPreview.numberDecisions?.some(d=>d.ambiguous)&&<div className="import-summary" role="alert"><strong>Cần xác nhận dấu thập phân</strong><p>{tradeImportPreview.numberDecisions.filter(d=>d.ambiguous).map(d=>d.field+': '+d.examples.join(' / ')).join(' · ')}</p><label>Dấu thập phân của cột mơ hồ<select aria-label="Dấu thập phân nhập file" value={numberChoice} onChange={e=>{const value=e.target.value as '.'|',';if(importFileV33.current&&value)void prepareTradeImport(importFileV33.current,value);}}><option value="">Chọn để đối chiếu lại Preview</option><option value=".">Dấu chấm: 1.085 = 1,085 đơn vị</option><option value=",">Dấu phẩy: 1.085 = 1.085 đơn vị nguyên</option></select></label></div>}
          <div className="cockpit-form">
            <label>
              Đơn vị P&L trong file
              <select
                aria-label="Đơn vị P&L nhập"
                value={importCurrency}
                onChange={(e) => void changeImportFx(e.target.value, importFx)}
              >
                <option>VND</option>
                <option>USDT</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </label>
            {importCurrency !== "VND" && (
              <label>
                Tỷ giá {importCurrency} → VNĐ
                <input
                  aria-label="Tỷ giá nhập về VNĐ"
                  type="number"
                  min="0.000001"
                  step="any"
                  value={importFx}
                  onChange={(e) =>
                    void changeImportFx(importCurrency, e.target.value)
                  }
                />
              </label>
            )}
          </div>
          <p className="import-summary">
            Xác nhận tiền tệ của P&L; không tự đổi USDT thành VNĐ. Giá và khối
            lượng giữ nguyên.
          </p>
          <div className="cockpit-form">
            <label>
              Tài khoản của nguồn nhập
              <select
                aria-label="Tài khoản nhập file"
                value={importAccount}
                onChange={(e) =>
                  void setImportScope(e.target.value, importBroker)
                }
              >
                <option value="">Chưa gắn tài khoản API</option>
                {connections.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Broker của nguồn nhập
              <select
                aria-label="Broker nhập file"
                value={importBroker}
                onChange={(e) =>
                  void setImportScope(importAccount, e.target.value)
                }
              >
                <option value="">Theo cột nguồn trong file</option>
                {[
                  "Binance",
                  "Bybit",
                  "OKX",
                  "Exness",
                  "MetaTrader 4",
                  "MetaTrader 5",
                  "VPS",
                  "SSI",
                  "CQG",
                ].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="import-summary">
            Chọn đúng cùng tài khoản và broker để đối soát chéo CSV/API. Không
            gộp báo cáo vị thế với execution chỉ vì cùng mã lệnh.
          </p>
          <p className="import-summary">
            <strong>{tradeImportPreview.trades.length} giao dịch hợp lệ</strong>{" "}
            · {tradeImportPreview.errors.length} dòng cần kiểm tra · Chỉ lưu sau
            khi bạn xác nhận.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Thị trường</th>
                  <th>Sản phẩm</th>
                  <th>Hướng</th>
                  <th>Khối lượng</th>
                  <th>Giá vào</th>
                  <th>Giá ra</th>
                  <th>Net sau phí</th>
                </tr>
              </thead>
              <tbody>
                {tradeImportPreview.trades.slice(0, 20).map((trade) => (
                  <tr key={`${trade.id}-${trade.date}`}>
                    <td>{trade.date}</td>
                    <td>{marketOf(trade)}</td>
                    <td>
                      <strong>{trade.symbol}</strong>
                    </td>
                    <td>{trade.side}</td>
                    <td>{trade.quantity ?? 0}</td>
                    <td>{trade.entryPrice ?? 0}</td>
                    <td>{trade.exitPrice ?? 0}</td>
                    <td
                      className={
                        netPnl(trade) >= 0 ? "positive-text" : "negative-text"
                      }
                    >
                      {trade.feesKnown === false || trade.pnlKnown === false
                        ? "Thiếu phí / P&L"
                        : money(netPnl(trade), true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tradeImportPreview.trades.length > 20 && (
            <p className="import-summary">
              Hiển thị 20 dòng đầu; sẽ lưu {tradeImportPreview.trades.length}{" "}
              giao dịch hợp lệ.
            </p>
          )}
          {tradeImportPreview.errors.length > 0 && (
            <p className="import-errors">
              {tradeImportPreview.errors.slice(0, 3).join(" · ")}
            </p>
          )}
          {ingestionPlan && (
            <div className="reconciliation-diff">
              <p>
                {ingestionPlan.duplicates.length} bản ghi trùng ID chắc chắn ·{" "}
                {ingestionPlan.candidates.length} cặp cần đối soát. Dấu vân tay
                làm tròn chỉ gợi ý, không tự xóa lệnh.
              </p>
              <div><button type="button" onClick={()=>setResolutions(Object.fromEntries(ingestionPlan.candidates.map(c=>[c.incoming.id,'skip' as Resolution])))}>Bỏ qua tất cả dòng nghi trùng</button><button type="button" onClick={()=>setResolutions(Object.fromEntries(ingestionPlan.candidates.map(c=>[c.incoming.id,'keep' as Resolution])))}>Giữ tất cả thành lệnh riêng</button><span> Xem tối đa 100 cặp đầu; quyết định hàng loạt áp dụng toàn bộ cặp đang đối soát.</span></div>
              {ingestionPlan.candidates.slice(0,100).map((c) => (
                <article key={c.incoming.id}>
                  <strong>
                    {c.reason} · {c.incoming.symbol}
                  </strong>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Dữ kiện</th>
                          <th>Đã có</th>
                          <th>Đang nhập</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            "id",
                            "date",
                            "source",
                            "accountId",
                            "externalId",
                            "quantity",
                            "entryPrice",
                            "pnl",
                            "fees",
                            "note",
                          ] as const
                        ).map((k) => (
                          <tr key={k}>
                            <td>{k}</td>
                            <td>{String(c.existing[k] ?? "—")}</td>
                            <td>{String(c.incoming[k] ?? "—")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label>
                    Cách xử lý
                    <select
                      value={resolutions[c.incoming.id] ?? ""}
                      onChange={(e) =>
                        setResolutions({
                          ...resolutions,
                          [c.incoming.id]: e.target.value as Resolution,
                        })
                      }
                    >
                      <option value="">Chưa quyết định</option>
                      <option value="skip">Bỏ qua dòng đang nhập</option>
                      <option value="enrich">
                        Cập nhật dữ kiện, giữ ghi chú đã có
                      </option>
                      <option value="keep">Giữ cả hai lệnh</option>
                    </select>
                  </label>
                </article>
              ))}
            </div>
          )}
          <div className="preview-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setTradeImportPreview(null)}
              disabled={tradeImportBusy}
            >
              Hủy
            </button>
            <button
              type="button"
              className="gold-button compact"
              onClick={() => void commitTradeImport()}
              disabled={
                tradeImportBusy ||
                !tradeImportPreview.trades.length ||
                tradeImportPreview.needsNumberConfirmation ||
                (importCurrency !== "VND" && !(Number(importFx) > 0)) ||
                !!ingestionPlan?.candidates.some(
                  (c) => !resolutions[c.incoming.id],
                )
              }
            >
              {tradeImportBusy
                ? "Đang lưu…"
                : `Thêm ${tradeImportPreview.trades.length} giao dịch`}
            </button>
          </div>
        </section>
      )}
      <section className="filter-bar">
        <label className="search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sản phẩm, setup, ghi chú..."
          />
        </label>
        <select
          value={journalMarket}
          onChange={(e) => setJournalMarket(e.target.value as "all" | Market)}
          aria-label="Lọc theo thị trường"
        >
          <option value="all">Tất cả thị trường</option>
          {MARKETS.slice(1).map((market) => (
            <option key={market.id} value={market.id}>
              {market.label}
            </option>
          ))}
        </select>
        <select
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          aria-label="Lọc theo sản phẩm"
        >
          <option value="all">Tất cả sản phẩm</option>
          {symbols.map((symbol) => (
            <option key={symbol}>{symbol}</option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          aria-label="Lọc theo kết quả"
        >
          <option value="all">Mọi kết quả</option>
          <option value="win">Thắng</option>
          <option value="loss">Thua</option>
          <option value="be">Hòa vốn</option>
        </select>
        <button
          className="ghost-button"
          onClick={() => {
            setQuery("");
            setSymbolFilter("all");
            setResultFilter("all");
            setJournalMarket("all");
          }}
        >
          Xóa lọc
        </button>
      </section>
      <section className="table-panel journal-results" aria-live="polite">
        <div className="journal-pagination" aria-label="Phân trang nhật ký"><button className="ghost-button" onClick={()=>{const page=Math.max(0,journalPage-1);setJournalPage(page);if(journalTrades.length>1000&&journalViewport.current?.clientHeight)journalViewport.current.scrollTop=page*200*48;}} disabled={journalPage===0}>Trang trước</button><span>{journalTrades.length.toLocaleString('vi-VN')} lệnh · Trang {journalPage+1}/{Math.max(1,Math.ceil(journalTrades.length/200))}</span><button className="ghost-button" onClick={()=>{const page=journalPage+1;setJournalPage(page);if(journalTrades.length>1000&&journalViewport.current?.clientHeight)journalViewport.current.scrollTop=page*200*48;}} disabled={(journalPage+1)*200>=journalTrades.length}>Trang sau</button></div>
        {journalTrades.length ? (
          <>
            <div className="journal-table-desktop">
              <div
                className={"table-scroll"+(journalTrades.length>1000?" journal-virtual-scroll":"")}
                ref={journalViewport}
                onScroll={event=>{if(journalTrades.length<=1000||journalFrame.current!==null)return;const node=event.currentTarget;journalFrame.current=requestAnimationFrame(()=>{journalFrame.current=null;setJournalScroll(node.scrollTop);setJournalPage(Math.floor(node.scrollTop/(48*200)));});}}
                tabIndex={0}
                aria-label="Bảng lịch sử giao dịch, có thể cuộn ngang"
              >
                <table className={journalTrades.length>1000?"classic-virtual-table":undefined} aria-rowcount={journalTrades.length+1}>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Thị trường</th>
                      <th>Sản phẩm</th>
                      <th>Nguồn</th>
                      <th>Hướng</th>
                      <th>Phiên</th>
                      <th>Setup</th>
                      <th>TF</th>
                      <th>Rủi ro</th>
                      <th>RR</th>
                      <th>Kết quả</th>
                      <th>Lãi / Lỗ</th>
                      <th>Kỷ luật</th>
                      <th>Ảnh</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {journalTrades.length>1000&&journalRange.top>0&&<tr aria-hidden="true"><td colSpan={16} style={{height:journalRange.top,padding:0,border:0}}/></tr>}
                    {desktopJournalTrades.map((trade,index) => {
                      const images = imagesByTrade.get(trade.id) ?? [];
                      return (
                        <tr key={trade.id} data-journal-id={trade.id} aria-rowindex={(journalTrades.length>1000?journalRange.start:journalPage*200)+index+2}>
                          <td>
                            {DATE.format(new Date(`${trade.date}T12:00:00`))}
                          </td>
                          <td>
                            <span
                              className={`market-badge market-${marketOf(trade).toLowerCase().replace(" ", "-")}`}
                            >
                              {marketOf(trade)}
                            </span>
                          </td>
                          <td>
                            <strong><JournalInlineCell value={trade.symbol} label={"mã "+trade.symbol} disabled={isDemo} onSave={(value,baseline)=>saveInlineTrade(trade.id,"symbol",value,baseline)}/></strong>
                          </td>
                          <td>
                            <span className="source-badge">
                              {trade.source ?? "Thủ công"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`side ${trade.side.toLowerCase()}`}
                            >
                              {trade.side}
                            </span>
                          </td>
                          <td>{trade.session}</td>
                          <td><JournalInlineCell value={trade.setup} label={"setup "+trade.symbol} disabled={isDemo} onSave={(value,baseline)=>saveInlineTrade(trade.id,"setup",value,baseline)}/></td>
                          <td>{trade.timeframe}</td>
                          <td>{money(trade.risk, true)}</td>
                          <td>
                            {trade.riskKnown!==false&&trade.risk>0&&trade.feesKnown!==false&&trade.pnlKnown!==false
                              ? (netPnl(trade)/trade.risk).toFixed(2)+' R'
                              : '○ Chưa xác minh'}
                          </td>
                          <td>
                            <span
                              className={`result ${JournalForm.outcome(netPnl(trade),trade.feesKnown!==false&&trade.pnlKnown!==false).tone}`}
                            >
                              {JournalForm.outcome(netPnl(trade),trade.feesKnown!==false&&trade.pnlKnown!==false).label}
                            </span>
                          </td>
                          <td
                            className={
                              netPnl(trade) >= 0
                                ? "positive-text"
                                : "negative-text"
                            }
                          >
                            {trade.feesKnown === false ||
                            trade.pnlKnown === false
                              ? "Thiếu phí / P&L"
                              : money(netPnl(trade), true)}
                          </td>
                          <td>
                            <span
                              className={`score ${trade.discipline >= 90 ? "good" : "warn"}`}
                            >
                              {trade.discipline}%
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`trade-image-count ${images.length ? "has-images" : ""}`}
                              disabled={!images.length}
                              onClick={() => setActiveImage(images[0])}
                              aria-label={
                                images.length
                                  ? `Xem ${images.length} ảnh của ${trade.symbol}`
                                  : `${trade.symbol} chưa có ảnh`
                              }
                            >
                              <Camera size={13} />
                              {images.length || "—"}
                            </button>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="icon-button edit"
                                onClick={() => openEditTradeModal(trade)}
                                aria-label={`Sửa lệnh ${trade.symbol}`}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                className="icon-button delete"
                                onClick={() => deleteTrade(trade.id)}
                                aria-label={`Xóa lệnh ${trade.symbol}`}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {journalTrades.length>1000&&journalRange.bottom>0&&<tr aria-hidden="true"><td colSpan={16} style={{height:journalRange.bottom,padding:0,border:0}}/></tr>}
                  </tbody>
                </table>
              </div>
              <p className="table-scroll-hint">
                Giữ Shift + lăn chuột hoặc kéo ngang để xem đủ dữ liệu.
              </p>
            </div>
            <div className="journal-mobile-list">
              {visibleJournalTrades.map((trade) => {
                const images = imagesByTrade.get(trade.id) ?? [];
                return (
                  <article className="journal-trade-card" key={trade.id}>
                    <header>
                      <div>
                        <strong>{trade.symbol}</strong>
                        <span>
                          {DATE.format(new Date(`${trade.date}T12:00:00`))} ·{" "}
                          {marketOf(trade)}
                        </span>
                      </div>
                      <span
                        className={`result ${JournalForm.outcome(netPnl(trade),trade.feesKnown!==false&&trade.pnlKnown!==false).tone}`}
                      >
                        {JournalForm.outcome(netPnl(trade),trade.feesKnown!==false&&trade.pnlKnown!==false).label}
                      </span>
                    </header>
                    <div className="journal-trade-summary">
                      <div>
                        <span>Lãi / Lỗ</span>
                        <strong
                          className={
                            netPnl(trade) >= 0
                              ? "positive-text"
                              : "negative-text"
                          }
                        >
                          {trade.feesKnown === false || trade.pnlKnown === false
                            ? "Thiếu phí / P&L"
                            : money(netPnl(trade), true)}
                        </strong>
                      </div>
                      <div>
                        <span>R:R</span>
                        <strong>
                          {trade.risk
                            ? (netPnl(trade) / trade.risk).toFixed(2)
                            : "0.00"}
                          R
                        </strong>
                      </div>
                      <div>
                        <span>Kỷ luật</span>
                        <strong>{trade.discipline}%</strong>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>Hướng · Phiên</dt>
                        <dd>
                          {trade.side} · {trade.session}
                        </dd>
                      </div>
                      <div>
                        <dt>Setup · Khung</dt>
                        <dd>
                          {trade.setup} · {trade.timeframe}
                        </dd>
                      </div>
                      <div>
                        <dt>Nguồn</dt>
                        <dd>{trade.source ?? "Thủ công"}</dd>
                      </div>
                    </dl>
                    <footer>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={!images.length}
                        onClick={() => setActiveImage(images[0])}
                      >
                        <Camera size={15} />{" "}
                        {images.length ? `${images.length} ảnh` : "Chưa có ảnh"}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => openEditTradeModal(trade)}
                      >
                        <Pencil size={15} /> Sửa
                      </button>
                      <button
                        type="button"
                        className="icon-button delete"
                        onClick={() => deleteTrade(trade.id)}
                        aria-label={`Xóa lệnh ${trade.symbol}`}
                      >
                        ×
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState
            title="Chưa có giao dịch phù hợp"
            copy="Thử thay đổi bộ lọc hoặc thêm một giao dịch mới."
          />
        )}
      </section>
    </>
  );

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const days = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: 42 }, (_, index) => {
      const day = index - offset + 1;
      return day >= 1 && day <= days ? day : null;
    });
    const tradesByDay = new Map<number, Trade[]>();
    filteredByRange
      .filter((trade) => {
        const date = new Date(`${trade.date}T12:00:00`);
        return (
          trade.recordKind !== "fill" &&
          date.getFullYear() === year &&
          date.getMonth() === month
        );
      })
      .forEach((trade) => {
        const day = Number(trade.date.slice(-2));
        tradesByDay.set(day, [...(tradesByDay.get(day) ?? []), trade]);
      });
    const monthLabel = new Intl.DateTimeFormat("vi-VN", {
      month: "long",
      year: "numeric",
    }).format(calendarMonth);
    return (
      <section className="calendar-panel panel">
        <div className="calendar-head">
          <button
            className="icon-button"
            onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
          >
            ‹
          </button>
          <div>
            <span className="eyebrow">NHỊP ĐỘ GIAO DỊCH</span>
            <h2>{monthLabel}</h2>
          </div>
          <button
            className="icon-button"
            onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
          >
            ›
          </button>
        </div>
        <div className="weekdays">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            const dayTrades = day ? (tradesByDay.get(day) ?? []) : [];
            const pnl = dayTrades.reduce(
              (sum, trade) => sum + netPnl(trade),
              0,
            );
            return (
              <div
                role={day ? "button" : undefined}
                tabIndex={day ? 0 : undefined}
                onClick={() => {
                  if (day) {
                    setDayFilter(
                      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
                    );
                    navigate("journal");
                  }
                }}
                onKeyDown={(e) => {
                  if (day && e.key === "Enter") {
                    setDayFilter(
                      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
                    );
                    navigate("journal");
                  }
                }}
                className={`calendar-day ${dayTrades.length ? (pnl >= 0 ? "profit" : "loss") : ""}`}
                key={`${day}-${index}`}
              >
                {day && (
                  <>
                    <span className="day-number">{day}</span>
                    {dayTrades.length > 0 && (
                      <div className="day-result">
                        <strong>{money(pnl, true)}</strong>
                        <small>{dayTrades.length} lệnh</small>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderPerformance = (
    dimension: "symbol" | "setup" | "session" | "weekday",
    title?: string,
  ) => {
    const grouped = groupTrades(filteredByRange, dimension);
    const max = Math.max(...grouped.map((item) => Math.abs(item.pnl)), 1);
    const leader = grouped[0];
    const enoughSample = Boolean(
      leader && leader.count >= MIN_ANALYTICS_SAMPLE,
    );
    return (
      <div className="performance-grid">
        <section className="panel performance-main">
          <div className="panel-title">
            <div>
              <span className="eyebrow">SO SÁNH HIỆU SUẤT</span>
              <h3>{title ?? "Lợi nhuận theo nhóm"}</h3>
            </div>
            <small className="sample-rule">
              Ngưỡng kết luận: ≥ {MIN_ANALYTICS_SAMPLE} lệnh/nhóm
            </small>
          </div>
          <div className="horizontal-bars">
            {grouped.map((item, index) => (
              <div className="horizontal-row" key={item.label}>
                <div className="rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="bar-info">
                  <div>
                    <strong>{item.label}</strong>
                    <span>
                      {item.count} lệnh ·{" "}
                      {((item.wins / item.count) * 100).toFixed(0)}% thắng ·{" "}
                      <em
                        className={
                          item.count >= MIN_ANALYTICS_SAMPLE
                            ? "confidence-ready"
                            : "confidence-low"
                        }
                      >
                        {item.count >= MIN_ANALYTICS_SAMPLE
                          ? "đủ mẫu"
                          : "mẫu nhỏ"}
                      </em>
                    </span>
                  </div>
                  <div className="bar-track">
                    <i
                      className={item.pnl >= 0 ? "up" : "down"}
                      style={{
                        width: `${Math.max(8, (Math.abs(item.pnl) / max) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <strong
                  className={item.pnl >= 0 ? "positive-text" : "negative-text"}
                >
                  {money(item.pnl, true)}
                </strong>
              </div>
            ))}
          </div>
        </section>
        <aside
          className={`panel insight-card ${enoughSample ? "" : "insufficient"}`}
        >
          <span className="eyebrow">DIỄN GIẢI DỮ LIỆU</span>
          <h3>
            {enoughSample ? "Lợi thế đã đủ mẫu" : "Chưa đủ dữ liệu để kết luận"}
          </h3>
          <div className="insight-number">{leader?.label ?? "—"}</div>
          <p>
            {leader
              ? enoughSample
                ? `${leader.label} đang dẫn đầu trên ${leader.count} giao dịch. Chỉ tăng tần suất khi điều kiện setup và mức rủi ro vẫn giữ nguyên.`
                : `${leader.label} hiện đứng đầu nhưng mới có ${leader.count} giao dịch. Cần thêm ít nhất ${Math.max(0, MIN_ANALYTICS_SAMPLE - leader.count)} lệnh cùng điều kiện trước khi coi đây là lợi thế.`
              : "Thêm giao dịch để hệ thống bắt đầu so sánh các nhóm."}
          </p>
          <div className="insight-rule">
            <span>Nguyên tắc</span>
            <strong>Không tăng rủi ro dựa trên mẫu nhỏ</strong>
          </div>
        </aside>
      </div>
    );
  };

  const renderHeatmap = () => {
    const days = [
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
      "Chủ Nhật",
    ];
    const sessions: Trade["session"][] = ["Châu Á", "London", "New York"];
    const maximum = Math.max(
      ...filteredByRange.map((trade) => Math.abs(netPnl(trade))),
      1,
    );
    return (
      <section className="panel heatmap-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">THỜI ĐIỂM GIAO DỊCH</span>
            <h3>Ngày × Phiên</h3>
          </div>
        </div>
        <div className="heatmap">
          <div />
          {sessions.map((session) => (
            <strong key={session}>{session}</strong>
          ))}
          {days.map((day) => (
            <Fragment key={day}>
              <span>{day.replace("Thứ ", "T")}</span>
              {sessions.map((session) => {
                const matching = filteredByRange.filter(
                  (trade) =>
                    dayName(trade.date) === day && trade.session === session,
                );
                const pnl = matching.reduce(
                  (sum, trade) => sum + netPnl(trade),
                  0,
                );
                const opacity = matching.length
                  ? 0.18 + (Math.abs(pnl) / maximum) * 0.55
                  : 0.04;
                return (
                  <div
                    key={`${day}-${session}`}
                    className={pnl >= 0 ? "cell-up" : "cell-down"}
                    style={{ opacity }}
                    title={`${day} · ${session}: ${money(pnl)}`}
                  >
                    {matching.length ? money(pnl, true) : "—"}
                  </div>
                );
              })}
            </Fragment>
          ))}{" "}
        </div>
        <div className="heatmap-note">
          <span /> Lãi <span /> Lỗ <small>Màu đậm hơn = tác động lớn hơn</small>
        </div>
      </section>
    );
  };

  const renderProcess = () => {
    const phases = [
      {
        number: "01",
        phase: "TRƯỚC LỆNH",
        title: "Xây dựng luận điểm",
        copy: "Tách dữ kiện khách quan khỏi kỳ vọng trước khi tìm điểm vào.",
        checks: [
          [
            "Bối cảnh",
            "Xu hướng D1/H4, trạng thái biến động, vùng giá và tin tức quan trọng.",
          ],
          [
            "Lợi thế",
            "Gọi đúng tên setup trong playbook và nêu điều kiện kích hoạt cụ thể.",
          ],
          [
            "Kịch bản",
            "Ghi entry, invalidation, SL, TP và trường hợp chủ động đứng ngoài.",
          ],
        ],
        gate: "Chỉ giao dịch khi setup A+ đủ điều kiện và RR kỳ vọng từ 1:2.",
      },
      {
        number: "02",
        phase: "TRONG LỆNH",
        title: "Thực thi kế hoạch",
        copy: "Quản trị phần có thể kiểm soát; không phản ứng theo P&L tức thời.",
        checks: [
          [
            "Kích hoạt",
            "Chờ tín hiệu đóng nến hoặc xác nhận cấu trúc; tuyệt đối không đuổi giá.",
          ],
          [
            "Rủi ro",
            "Đúng khối lượng, rủi ro tối đa 1%; không nới SL hoặc trung bình giá lỗ.",
          ],
          [
            "Quản lý",
            "Dời SL, chốt một phần hoặc thoát lệnh đúng điều kiện đã viết trước.",
          ],
        ],
        gate: "Nếu phải thay đổi kế hoạch, ghi lý do trước khi hành động.",
      },
      {
        number: "03",
        phase: "SAU LỆNH",
        title: "Review quyết định",
        copy: "Đánh giá chất lượng quy trình độc lập với kết quả lời hay lỗ.",
        checks: [
          [
            "Bằng chứng",
            "Lưu ảnh trước/sau lệnh, kết quả theo R và số tiền thực tế.",
          ],
          [
            "Tuân thủ",
            "Chấm đúng setup, đúng rủi ro, đúng quản lý và trạng thái tâm lý.",
          ],
          [
            "Cải thiện",
            "Ghi một bài học kiểm chứng được và một hành động cho lệnh kế tiếp.",
          ],
        ],
        gate: `Không sửa hệ thống từ một lệnh; chỉ kết luận khi có ít nhất ${MIN_ANALYTICS_SAMPLE} mẫu cùng điều kiện.`,
      },
    ];
    const principles = [
      ["Bảo vệ vốn", "Rủi ro được xác định trước lợi nhuận."],
      [
        "Kỷ luật trước kết quả",
        "Một lệnh thắng sai quy trình vẫn là lệnh kém.",
      ],
      [
        "Đủ mẫu mới kết luận",
        `Ít nhất ${MIN_ANALYTICS_SAMPLE} lệnh cùng điều kiện.`,
      ],
      [
        "Đứng ngoài là một vị thế",
        "Không có setup A+ thì không cần giao dịch.",
      ],
    ];
    return (
      <>
        <section className="process-hero">
          <div>
            <span className="eyebrow">EXECUTION PROTOCOL</span>
            <h2>Một quyết định tốt phải có thể giải thích và lặp lại</h2>
            <p>
              Đi từ dữ kiện đến kế hoạch, từ kế hoạch đến thực thi, rồi dùng dữ
              liệu để cải thiện — không dùng cảm xúc hoặc một kết quả đơn lẻ để
              thay đổi hệ thống.
            </p>
          </div>
          <div className="process-priority">
            <small>THỨ TỰ ƯU TIÊN</small>
            <strong>
              Bảo vệ vốn <i>→</i> Tuân thủ <i>→</i> Kết quả
            </strong>
          </div>
        </section>
        <section className="process-grid">
          {phases.map((phase) => (
            <article className="process-card" key={phase.number}>
              <header>
                <span>{phase.number}</span>
                <div>
                  <small>{phase.phase}</small>
                  <h3>{phase.title}</h3>
                  <p>{phase.copy}</p>
                </div>
              </header>
              <div className="process-checklist">
                {phase.checks.map(([label, copy]) => (
                  <div key={label}>
                    <i>✓</i>
                    <p>
                      <strong>{label}</strong>
                      <span>{copy}</span>
                    </p>
                  </div>
                ))}
              </div>
              <footer>
                <ShieldCheck size={15} />
                <span>
                  <small>CỔNG KIỂM TRA</small>
                  <strong>{phase.gate}</strong>
                </span>
              </footer>
            </article>
          ))}
        </section>
        <section className="process-principles">
          <div>
            <span className="eyebrow">NGUYÊN TẮC BẤT BIẾN</span>
            <h3>Giữ đúng hệ thống trước khi tối ưu kết quả</h3>
          </div>
          <div className="process-principle-grid">
            {principles.map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  };

  const renderNotes = () => (
    <>
      <section className="note-template-panel">
        <div className="note-template-heading">
          <div>
            <span className="eyebrow">MẪU GHI CHUYÊN NGHIỆP</span>
            <h3>Bắt đầu bằng đúng cấu trúc</h3>
          </div>
          <p>Mẫu mới được chèn nối tiếp, không ghi đè nội dung hiện có.</p>
        </div>
        <div className="note-template-grid">
          {NOTE_TEMPLATES.map((template) => (
            <button
              type="button"
              key={template.id}
              onClick={() => insertNoteTemplate(template)}
              aria-label={`Chèn mẫu ${template.label}`}
            >
              <span>{template.code}</span>
              <div>
                <strong>{template.label}</strong>
                <small>{template.description}</small>
              </div>
              <Copy size={15} />
            </button>
          ))}
        </div>
      </section>
      <section className="notes-layout">
        <article className="panel note-editor">
          <div className="panel-title">
            <div>
              <span className="eyebrow">DECISION JOURNAL</span>
              <h3>Kế hoạch, bằng chứng & bài học</h3>
            </div>
            <span className="auto-save">Lưu trên thiết bị</span>
          </div>
          <div className="note-writing-rule">
            <ShieldCheck size={16} />
            <p>
              <strong>Quy tắc viết:</strong> ghi sự thật trước nhận định, mô tả
              quyết định trước kết quả và luôn kết thúc bằng một hành động cụ
              thể.
            </p>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Ghi chú và review giao dịch"
            spellCheck="false"
          />
          <div className="note-editor-footer">
            <small>
              {notes.length.toLocaleString("vi-VN")} ký tự · Nội dung chỉ được
              lưu khi bạn bấm nút
            </small>
            <button
              type="button"
              className="gold-button compact"
              onClick={saveNotes}
            >
              Lưu ghi chú
            </button>
          </div>
        </article>
        <aside className="note-review-column">
          <section className="panel review-framework">
            <span className="eyebrow">REVIEW FRAMEWORK</span>
            <h3>4 lớp đánh giá</h3>
            <div>
              {[
                ["01", "Sự thật", "Điều gì đã xảy ra, có bằng chứng nào?"],
                [
                  "02",
                  "Quyết định",
                  "Tại sao vào lệnh và điều kiện nào bị vi phạm?",
                ],
                ["03", "Quy trình", "Kết quả đến từ lợi thế hay từ may mắn?"],
                [
                  "04",
                  "Hành động",
                  "Một thay đổi nhỏ nào sẽ được đo ở lần tới?",
                ],
              ].map(([number, title, copy]) => (
                <article key={number}>
                  <span>{number}</span>
                  <p>
                    <strong>{title}</strong>
                    <small>{copy}</small>
                  </p>
                </article>
              ))}
            </div>
          </section>
          <section className="panel weekly-card">
            <span className="eyebrow">REVIEW TUẦN</span>
            <h3>Câu hỏi ra quyết định</h3>
            <ol>
              <li>
                <strong>Lợi thế nào đã đủ mẫu?</strong>
                <span>
                  So sánh setup, phiên và sản phẩm trên cùng điều kiện.
                </span>
              </li>
              <li>
                <strong>Sai lệch nào đang lặp lại?</strong>
                <span>Đo tần suất và tác động, không chỉ kể lại cảm xúc.</span>
              </li>
              <li>
                <strong>Tuần tới ưu tiên điều gì?</strong>
                <span>Chọn một hành vi có thể quan sát và đo lường.</span>
              </li>
            </ol>
            <div className="mindset">
              <span>NGUYÊN TẮC</span>
              <strong>
                Đánh giá quy trình bằng dữ liệu; không đánh giá bản thân bằng
                một lệnh.
              </strong>
            </div>
          </section>
        </aside>
      </section>
    </>
  );

  const renderConnections = () => (
    <>
      <section className="security-banner">
        <div className="security-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <span className="eyebrow">KẾT NỐI AN TOÀN</span>
          <h3>Một journal cho mọi thị trường</h3>
          <p>
            API key và bridge token được mã hóa AES-GCM phía máy chủ. Mật khẩu,
            PIN/OTP và private key đặt lệnh luôn nằm ngoài journal.
          </p>
        </div>
        <span className={`cloud-status ${dataMode}`}>
          <i />
          {dataMode === "cloud"
            ? "Vùng dữ liệu riêng đã sẵn sàng"
            : "Đang lưu trên thiết bị"}
        </span>
      </section>
      <section className="auto-sync-banner">
        <span className="auto-sync-icon">
          <Radio size={19} />
        </span>
        <div>
          <span className="eyebrow">AUTO SYNC</span>
          <h3>Push 24/7 hoặc tự kéo dữ liệu mỗi 15 phút</h3>
          <p>
            VPS, SSI, TCX, MT5 và CQG có thể nhận push liên tục. Bật tùy chọn để
            kiểm tra Pull và Binance/Bybit mỗi 15 phút trong phiên này, hoặc bấm
            đồng bộ ngay.
          </p>
        </div>
        <div className="auto-sync-status">
          <label>
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(event) => setAutoSyncEnabled(event.target.checked)}
            />{" "}
            Bật tự đồng bộ 15 phút trong phiên này
          </label>
          <small>{autoSyncStatus}</small>
          <button
            type="button"
            className="ghost-button"
            disabled={autoSyncing || !connections.some(isAutoSyncConnection)}
            onClick={() => void syncAllConnections()}
          >
            {autoSyncing ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            {autoSyncing ? "Đang đồng bộ…" : "Đồng bộ tất cả"}
          </button>
        </div>
      </section>
      <section className="broker-grid">
        {BROKERS.map((broker) => {
          const connection = connections.find(
            (item) => item.provider === broker.provider,
          );
          const canSync = connection && isAutoSyncConnection(connection);
          return (
            <article
              className={`broker-card broker-${broker.provider}`}
              key={broker.provider}
            >
              <div className="broker-head">
                <span className="broker-logo">{broker.badge}</span>
                <div>
                  <h3>{broker.name}</h3>
                  <small>{broker.mode}</small>
                </div>
                <span
                  className={`connection-state ${connection ? "connected" : "idle"}`}
                >
                  <i />
                  {connection ? "Đã cấu hình" : "Chưa kết nối"}
                </span>
              </div>
              <p>{broker.copy}</p>
              {connection && (
                <div className="connection-meta">
                  <span>{connection.label}</span>
                  <small>
                    {isBridgeProvider(connection.provider)
                      ? connection.accountType === "push"
                        ? "Push 24/7 · tự nhận lệnh"
                        : "Pull · kiểm tra mỗi 15 phút"
                      : connection.lastSyncAt
                        ? `Đồng bộ ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(connection.lastSyncAt))}`
                        : "Chưa đồng bộ lần đầu"}
                  </small>
                  {isBridgeProvider(connection.provider) &&
                    connection.lastSyncAt && (
                      <small>
                        Cập nhật{" "}
                        {new Intl.DateTimeFormat("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(connection.lastSyncAt))}
                      </small>
                    )}
                </div>
              )}
              {broker.provider === "vn-broker" ? (
                <div className="vn-import-controls">
                  <select
                    value={connectionDraft.brokerName}
                    onChange={(e) =>
                      setConnectionDraft({
                        ...connectionDraft,
                        brokerName: e.target.value,
                      })
                    }
                    aria-label="Chọn broker chứng khoán"
                  >
                    <option>VPS</option>
                    <option>SSI</option>
                    <option>TCBS</option>
                    <option>VNDIRECT</option>
                    <option>MBS</option>
                    <option>HSC</option>
                    <option>Broker VN</option>
                  </select>
                  <label className="gold-button compact file-button">
                    Nhập CSV
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv"
                      multiple
                      data-market="Chứng khoán"
                      data-broker={connectionDraft.brokerName}
                      onChange={importCsv}
                    />
                  </label>
                </div>
              ) : (
                <div className="broker-actions">
                  {canSync && (
                    <button
                      type="button"
                      className="gold-button compact"
                      disabled={syncingId === connection.id}
                      onClick={() => void syncConnection(connection)}
                    >
                      {syncingId === connection.id
                        ? "Đang đồng bộ…"
                        : "Đồng bộ ngay"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${connection ? "ghost-button" : "gold-button compact"} ${dataMode !== "cloud" ? "requires-cloud" : ""}`}
                    onClick={() => openConnection(broker.provider)}
                  >
                    {connection
                      ? broker.provider === "webhook" ||
                        (isBridgeProvider(broker.provider) &&
                          connection.accountType === "push")
                        ? "Cập nhật / token"
                        : "Cập nhật"
                      : dataMode !== "cloud"
                        ? "Cần cloud riêng"
                        : broker.provider === "tradingview"
                          ? "Xem thiết lập"
                          : "Kết nối"}
                  </button>
                  {connection && (
                    <button
                      type="button"
                      className="icon-button delete"
                      onClick={() => void disconnect(connection)}
                      aria-label={`Ngắt ${broker.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              <div className="broker-foot">
                <span>{broker.scope}</span>
                <span>Không đặt lệnh</span>
              </div>
            </article>
          );
        })}
      </section>
      <section className="quick-import-panel panel">
        <div>
          <span className="eyebrow">NHẬP NHANH ĐA THỊ TRƯỜNG</span>
          <h3>Thả nhiều statement cùng lúc</h3>
          <p>
            Khi broker chưa có API trực tiếp, xuất CSV rồi nhập một lần; hệ
            thống tự dò cột và chống trùng dữ liệu.
          </p>
        </div>
        <div className="quick-import-grid">
          {(
            [
              {
                market: "Chứng khoán",
                broker: "Broker chứng khoán",
                icon: "▥",
                copy: "VPS · SSI · TCBS · VNDIRECT…",
              },
              {
                market: "Forex",
                broker: "MT5 / Forex",
                icon: "↕",
                copy: "MT5 statement · cTrader export",
              },
              {
                market: "Crypto",
                broker: "Sàn Crypto",
                icon: "₿",
                copy: "Binance · Bybit · OKX…",
              },
              {
                market: "Hàng hóa",
                broker: "CQG / MXV",
                icon: "◈",
                copy: "CQG statement · broker hàng hóa",
              },
            ] as Array<{
              market: Market;
              broker: string;
              icon: string;
              copy: string;
            }>
          ).map((item) => (
            <label className="quick-import-card" key={item.market}>
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                multiple
                data-market={item.market}
                data-broker={item.broker}
                onChange={importCsv}
              />
              <span>{item.icon}</span>
              <div>
                <strong>{item.market}</strong>
                <small>{item.copy}</small>
              </div>
              <FileUp size={15} />
            </label>
          ))}
        </div>
      </section>
      <section className="sync-explainer panel">
        <div>
          <span className="eyebrow">CHIẾN LƯỢC ĐỒNG BỘ</span>
          <h3>Ba tầng để giảm tối đa nhập tay</h3>
        </div>
        <div className="sync-flow">
          <article>
            <span>01</span>
            <strong>Pull có lịch</strong>
            <p>
              VPS, SSI, TCX, MT5, CQG, Binance và Bybit tự kiểm tra khi mở
              trang, sau đó lặp lại mỗi 15 phút.
            </p>
          </article>
          <article>
            <span>02</span>
            <strong>Push 24/7</strong>
            <p>
              Bridge của 5 nền tảng gửi lệnh bất cứ lúc nào bằng token riêng,
              không cần mở app.
            </p>
          </article>
          <article>
            <span>03</span>
            <strong>Chỉ review phần quan trọng</strong>
            <p>
              Lệnh mới được gắn “Chưa phân loại”; bạn chỉ sửa setup, rủi ro và
              checklist sau giao dịch.
            </p>
          </article>
        </div>
      </section>
    </>
  );

  const renderSettings = () => (
    <section className="settings-grid">
      <article className="panel settings-card">
        <div>
          <span className="eyebrow">NHẬN DIỆN</span>
          <h3>Hồ sơ nhật ký</h3>
        </div>
        <label>
          Tên hiển thị
          <input defaultValue="Tuan Trader" />
        </label>
        <label>
          Khẩu hiệu
          <input defaultValue="Kỷ luật · Kiên định · Tăng trưởng" />
        </label>
        <label>
          Tiền tệ
          <select defaultValue="VND">
            <option>VND</option>
            <option>USD</option>
          </select>
        </label>
        <button
          className="gold-button compact"
          onClick={() => setToast("Đã lưu cài đặt hiển thị.")}
        >
          Lưu thay đổi
        </button>
      </article>
      <article className="panel settings-card">
        <div>
          <span className="eyebrow">DỮ LIỆU & SAO LƯU</span>
          <h3>Quản lý dữ liệu</h3>
          <p>Nhật ký mới bắt đầu trống. Chỉ nạp mẫu khi bạn chủ động chọn; sau khi khóa sẽ không nạp lại.</p>
        </div>
        <div className={`data-mode-card ${dataMode}`}>
          <Database size={18} />
          <div>
            <strong>
              {isDemo
                ? "Đang xem dữ liệu minh họa"
                : dataMode === "cloud"
                  ? "Đồng bộ riêng tư đang hoạt động"
                  : "Dữ liệu đang ở thiết bị này"}
            </strong>
            <p>
              {isDemo
                ? "Các con số hiện tại chỉ để trải nghiệm tính năng, không phải kết quả giao dịch thật."
                : dataMode === "cloud"
                  ? "Giao dịch được lưu trong vùng dữ liệu riêng."
                  : "Nhật ký được lưu trong trình duyệt hiện tại; hãy xuất bản sao định kỳ để chuyển dữ liệu sang thiết bị khác."}
            </p>
          </div>
        </div>
        <div className="backup-actions">
          <button className="ghost-button full" onClick={()=>void undoJournal()}>Hoàn tác thao tác nhật ký</button>
          <button className="danger-button" onClick={()=>void hardResetJournal()}>Xóa sạch nhật ký (có sao lưu)</button>
          <button className="ghost-button full" onClick={exportBackup}>
            <FileDown size={16} /> Xuất bản sao JSON
          </button>
          <label className="ghost-button full file-button backup-file">
            <FileUp size={16} /> Nhập bản sao
            <input
              type="file"
              accept="application/json,.json"
              onChange={importBackup}
            />
          </label>
        </div>
        {!isDemo && (
          <button className="ghost-button full" onClick={restoreDemo}>
            Xem dữ liệu minh họa
          </button>
        )}
        <button className="danger-button" onClick={clearAll}>
          {isDemo ? "Bắt đầu với nhật ký trống" : "Xóa toàn bộ giao dịch"}
        </button>
        <small className="backup-note">
          Bản sao không chứa API key, API secret hoặc token broker.
        </small>
      </article>
    </section>
  );

  const projected = useMemo(
    () => [...trades, ...positionCycles(trades).closed],
    [trades],
  );
  const filteredProjected = useMemo(
    () => [...filteredByRange, ...positionCycles(filteredByRange).closed],
    [filteredByRange],
  );
  const renderCockpit = (mode: "overview" | "risk" | "analytics") => (
    <UnifiedRiskAnalyticsCockpit
      key={accountId}
      ready={persistenceOwner === accountId}
      trades={filteredProjected}
      allTrades={projected}
      settings={riskSettings}
      setSettings={setRiskSettings}
      mode={mode}
      onDay={(date) => {
        setDayFilter(date);
        navigate("journal");
      }}
      onJournal={() => navigate("journal")}
      onNewTrade={(plan) => {
        openTradeModal();
        if (plan) {
          setDraft({
            ...makeDraft(),
            entryPrice: String(plan.entry),
            stopLoss: String(plan.stop),
            takeProfit: String(plan.target),
            quantity: String(plan.quantity),
            risk: String(plan.risk),
            side: plan.side,
            plan: true,
          });
          setDraftRestored(false);
        }
      }}
      onEndSession={() => void exportGovernance("xlsx")}
    />
  );
  const renderContent = () => {
    switch (view) {
      case "overview":
        return renderCockpit("overview");
      case "journal":
        return renderJournal();
      case "calendar":
        return renderCalendar();
      case "analytics":
        return renderCockpit("analytics");
      case "risk":
        return renderCockpit("risk");
      case "statistics":
        return (
          <TradingMetrix
            trades={trades
              .filter((t) => t.recordKind !== "fill")
              .map((t) => ({ ...t, pnl: netPnl(t) }))}
          />
        );
      case "system-tracker":
        return (
          <SystemTracker
            trades={trades
              .filter((t) => t.recordKind !== "fill")
              .map((t) => ({ ...t, pnl: netPnl(t) }))}
            onOpenJournal={() => navigate("journal")}
          />
        );
      case "valuation":
        return <CompanyValuation />;
      case "pair":
        return renderPerformance("symbol", "Lãi / Lỗ theo sản phẩm");
      case "setup":
        return renderPerformance("setup", "Lãi / Lỗ theo setup");
      case "weekday":
        return renderPerformance("weekday", "Lãi / Lỗ theo ngày trong tuần");
      case "heatmap":
        return renderHeatmap();
      case "process":
        return renderProcess();
      case "notes":
        return renderNotes();
      case "connections":
        return renderConnections();
      case "settings":
        return (
          <>
            <GovernanceCenter
              accountId={accountId}
              dataMode={dataMode}
              settings={riskSettings}
              setSettings={setRiskSettings}
              exportReport={exportGovernance}
              queue={queueItems}
              refreshQueue={refreshQueue}
              discardQueued={discardQueued}
              onRestore={async (restored) => {
                if (restored) {
                  setTrades((current) => {
                    const map = new Map(current.map((t) => [t.id, t]));
                    map.set(restored.id, restored as Trade);
                    const next = [...map.values()];
                    void persistClassicLedger(tradesStorageKey, next,{history:true,before:trades}).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
                    return next;
                  });
                  return;
                }
                const r = await fetchAllTrades({ headers: { "X-Journal-Owner": accountId } });
                if (r.ok) {
                  const p = (await r.json()) as { trades: Trade[] };
                  setTrades(p.trades);
                  void persistClassicLedger(tradesStorageKey, p.trades).catch(()=>setToast("Chưa lưu được nhật ký trên thiết bị; bản cloud được giữ."));
                }
              }}
            />
            {renderSettings()}
          </>
        );
    }
  };

  const draftRiskValue = assetInput.enabled ? (assetPreview.value?.is_1r_verified ? (assetPreview.value.initial_1r_money ?? NaN) : NaN) : Number(draft.risk);
  const draftPnlValue = draft.pnl === "" ? null : Number(draft.pnl);
  const draftFeesValue = Number(draft.fees) || 0;
  const draftEntryValue = Number(draft.entryPrice);
  const draftStopValue = Number(draft.stopLoss);
  const draftTargetValue = Number(draft.takeProfit);
  const draftPriceRisk =
    draft.side === "Buy"
      ? draftEntryValue - draftStopValue
      : draftStopValue - draftEntryValue;
  const draftPriceReward =
    draft.side === "Buy"
      ? draftTargetValue - draftEntryValue
      : draftEntryValue - draftTargetValue;
  const draftHasPricePlan =
    draftEntryValue > 0 && draftStopValue > 0 && draftTargetValue > 0;
  const draftPlannedRr =
    draftHasPricePlan && draftPriceRisk > 0 && draftPriceReward > 0
      ? draftPriceReward / draftPriceRisk
      : null;
  const draftNetPnl = assetInput.enabled ? (assetPreview.value?.is_net_pnl_verified ? assetPreview.value.net_pnl : null) :
    draftPnlValue === null || !Number.isFinite(draftPnlValue)
      ? null
      : draftPnlValue - draftFeesValue;
  const draftActualR =
    draftNetPnl !== null && draftRiskValue > 0
      ? draftNetPnl / draftRiskValue
      : null;
  const draftChecks = [
    draft.plan,
    draft.noFomo,
    draft.noRevenge,
    draft.screenshot,
  ];
  const draftDiscipline = Math.round(
    (draftChecks.filter(Boolean).length / draftChecks.length) * 100,
  );
  const draftRequired = [
    Boolean(draft.date),
    Boolean(draft.symbol.trim()),
    draft.setup !== UNCLASSIFIED_SETUP,
    assetInput.enabled ? !assetPreview.error : Number.isFinite(draftRiskValue) && draftRiskValue > 0,
    assetInput.enabled ? Boolean(assetPreview.value?.is_net_pnl_verified && JournalForm.costs(assetPreview.value)) : draftPnlValue !== null && Number.isFinite(draftPnlValue),
  ];
  const draftQualitySignals = [
    ...draftRequired,
    draftHasPricePlan,
    draft.screenshot || draftImages.length > 0,
    Boolean(draft.note.trim()),
  ];
  const draftCompleteness = Math.round(
    (draftQualitySignals.filter(Boolean).length / draftQualitySignals.length) *
      100,
  );
  const draftReady = draftRequired.every(Boolean);
  const meta = VIEW_META[view];
  return (
    <div className="app-shell" data-colors={riskSettings.colorMode}>
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <b />
          </div>
          <strong>
            <span>Tuan</span> Trader
          </strong>
          <small>KỶ LUẬT · KIÊN ĐỊNH · TĂNG TRƯỞNG</small>
        </div>
        <nav aria-label="Điều hướng chính">
          {NAV_GROUPS.map((group) => (
            <section
              className="nav-group"
              aria-label={group.label}
              key={group.label}
            >
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-current={view === item.id ? "page" : undefined}
                    className={view === item.id ? "active" : ""}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon className="nav-icon" size={17} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="gold-button"
            disabled={persistenceOwner !== accountId}
            onClick={openTradeModal}
          >
            <Plus size={17} /> <span>Thêm giao dịch</span>
          </button>
          <div>
            <span>{trades.length} lệnh</span>
            <small>•</small>
            <span>{isDemo ? "Dữ liệu mẫu" : money(allStats.net, true)}</span>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="main-content" id="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Mở menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={18} />
          </button>
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="top-actions">
            <button
              className="ghost-button command-trigger"
              onClick={() => setPaletteOpen(true)}
            >
              Tìm lệnh <kbd>Ctrl K</kbd>
            </button>
            <span className={`data-state-chip ${isDemo ? "demo" : dataMode}`}>
              <Database size={14} />
              {isDemo
                ? "Dữ liệu minh họa"
                : localFallback
                  ? "Trên thiết bị · cloud trống"
                  : dataMode === "cloud"
                    ? "Đã đồng bộ"
                    : "Trên thiết bị"}
            </span>
            {
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                aria-label="Khoảng thời gian"
              >
                <option value="all">Toàn bộ thời gian</option>
                <option value="30">30 ngày qua</option>
                <option value="90">90 ngày qua</option>
              </select>
            }
            <button
              className="quick-add"
              aria-label="Thêm lệnh"
              disabled={persistenceOwner !== accountId}
              onClick={openTradeModal}
            >
              <Plus size={16} /> <span>Thêm lệnh</span>
            </button>
          </div>
          <nav className="workspace-switch" aria-label="Chuyển giao diện">
            <span>Giao diện</span>
            <a href="/classic#overview" aria-current="page">
              Classic
            </a>
            <a href="/v6/#overview">v6</a>
          </nav>
        </header>
        <div className="content-area">
          <section className="hub-notice" aria-label="Chọn không gian làm việc">
            <strong>Tuấn Nhật Ký · Không gian Classic</strong>
            <p>
              Kết nối sàn, đồng bộ, ảnh, nhập báo cáo và cấu hình theo giao diện
              gốc. <a href="/v6/#overview">Mở sổ v6 đã khôi phục</a> ·{" "}
              <a href="/legacy#connections">Nhập nhiều tài khoản / MT4–MT5</a>.
              Classic và v6 dùng chung nhật ký trên thiết bị cho cùng tài khoản và
              đơn vị tiền. Thay đổi lệnh được đồng bộ giữa hai giao diện.
            </p>
          </section>
          {isDemo && (
            <section className="demo-banner" role="status">
              <div className="demo-icon">
                <Sparkles size={18} />
              </div>
              <div>
                <span>CHẾ ĐỘ MINH HỌA</span>
                <strong>Toàn bộ giao dịch đang hiển thị là dữ liệu mẫu</strong>
                <p>
                  Dữ liệu này dùng để trải nghiệm tính năng, không phải thành
                  tích giao dịch thực tế hay bằng chứng về lợi nhuận.
                </p>
              </div>
              <div className="demo-actions">
                <button type="button" onClick={startRealJournal}>
                  Bắt đầu nhật ký thật
                </button>
                <a href="/phuong-phap">Xem phương pháp</a>
              </div>
            </section>
          )}
          <div className="sticky-scope">
            <label>
              Lọc chung
              <input
                aria-label="Tìm kiếm toàn không gian"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mã, setup, ghi chú"
              />
            </label>
            <label>
              Ngày
              <input
                aria-label="Ngày đang lọc"
                type="date"
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
              />
            </label>
            <label>
              Thị trường
              <select
                aria-label="Thị trường chung"
                value={marketScope}
                onChange={(e) =>
                  setMarketScope(e.target.value as typeof marketScope)
                }
              >
                <option value="all">Tất cả</option>
                <option>Hàng hóa</option>
                <option>Chứng khoán</option>
                <option>Crypto</option>
                <option>Forex</option>
              </select>
            </label>
            <button
              className="ghost-button"
              onClick={() => {
                setDayFilter("");
                setQuery("");
                setSymbolFilter("all");
                setResultFilter("all");
                setRange("all");
                setMarketScope("all");
              }}
            >
              Xóa bộ lọc
            </button>
            {queueItems.length > 0 && (
              <button onClick={() => navigate("settings")}>
                {queueItems.length} mục chờ đồng bộ
              </button>
            )}
          </div>
          {renderContent()}
        </div>
        <footer className="app-footer">
          <div>
            <span>Tuan Trader · Trading Plan Pro</span>
            <small>
              {isDemo
                ? "Dữ liệu minh họa — không phải kết quả thực tế"
                : dataMode === "cloud"
                  ? "Dữ liệu riêng đã đồng bộ"
                  : "Dữ liệu đang lưu trên thiết bị"}{" "}
              · Không phải khuyến nghị đầu tư.
            </small>
          </div>
          <nav aria-label="Thông tin website">
            <a href="/phuong-phap">Phương pháp</a>
            <a href="/bao-mat">Bảo mật dữ liệu</a>
          </nav>
        </footer>
      </main>

      {paletteOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPaletteOpen(false);
          }}
        >
          <section
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Lệnh nhanh"
          >
            <header>
              <h2>Lệnh nhanh</h2>
              <button
                onClick={() => setPaletteOpen(false)}
                aria-label="Đóng lệnh nhanh"
              >
                ×
              </button>
            </header>
            <input
              autoFocus
              placeholder="Tìm tác vụ..."
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
            />
            {[
              ...NAV_GROUPS.flatMap((g) =>
                g.items.map((i) => ({
                  label: i.label,
                  run: () => navigate(i.id),
                })),
              ),
              { label: "Ghi nhận giao dịch", run: openTradeModal },
              {
                label: "Đồng bộ tất cả kết nối",
                run: () => void syncAllConnections(),
              },
              {
                label: "Xuất Excel 5 trang tính",
                run: () => void exportGovernance("xlsx"),
              },
              {
                label: "Xuất PDF một trang",
                run: () => void exportGovernance("pdf"),
              },
            ]
              .filter((c) =>
                c.label.toLowerCase().includes(paletteQuery.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.label}
                  onClick={() => {
                    setPaletteOpen(false);
                    c.run();
                  }}
                >
                  {c.label}
                </button>
              ))}
          </section>
        </div>
      )}
      {modalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false);
              setEditingTradeId(null);
            }
          }}
        >
          <form
            className="trade-modal professional-trade-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trade-dialog-title"
            onSubmit={saveTrade}
          >
            <div className="modal-head trade-modal-head">
              <div>
                <span className="eyebrow">TRADE EXECUTION RECORD</span>
                <h2 id="trade-dialog-title">
                  {editingTradeId
                    ? "Cập nhật hồ sơ giao dịch"
                    : "Ghi nhận giao dịch mới"}
                </h2>
                <p>
                  {editingTradeId
                    ? "Hoàn thiện dữ liệu kế hoạch, kết quả và review cho lệnh đã có."
                    : "Ghi dữ kiện trước, đánh giá quy trình sau — kết quả chỉ là một phần của hồ sơ."}
                </p>
              </div>
              <div className="trade-modal-head-actions">
                <span>
                  <i /> Trường có dấu * là bắt buộc
                </span>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingTradeId(null);
                  }}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="trade-modal-workspace">
              <div className="trade-form-flow"><AssetTradeForm value={assetInput} onChange={changeAsset} preview={assetInput.enabled?(assetPreview.error||JournalForm.status(assetPreview.value)):"Nhập tay như hiện tại. Bật xác minh để tính 1R/Net từ dữ kiện đã đối soát."}/>
                <section className="form-section">
                  <div className="form-section-title">
                    <span>01</span>
                    <div>
                      <h3>Bối cảnh & setup</h3>
                      <p>Xác định chính xác lệnh nào đang được đánh giá</p>
                    </div>
                  </div>
                  <div className="form-grid three">
                    <label>
                      Ngày giao dịch *
                      <input
                        type="date"
                        value={draft.date}
                        onChange={(e) =>
                          setDraft({ ...draft, date: e.target.value })
                        }
                        required
                      />
                    </label>
                    <label>
                      Thị trường
                      <select
                        value={draft.market}
                        onChange={(e) => {
                          setDraft({...draft,market:e.target.value as Market});
                          setAssetInput(prior=>({...prior,asset_class:JournalForm.asset(e.target.value),quantity_step:JournalForm.profiles[JournalForm.asset(e.target.value)].step,multiplier_verified:false}));
                        }}
                      >
                        <option>Hàng hóa</option>
                        <option>Chứng khoán</option>
                        <option>Crypto</option>
                        <option>Forex</option>
                      </select>
                    </label>
                    <label>
                      Sản phẩm *
                      <input
                        value={draft.symbol}
                        onChange={(e) =>
                          setDraft({ ...draft, symbol: e.target.value })
                        }
                        placeholder="FPT, XAUUSD, BTCUSDT..."
                        autoComplete="off"
                        required
                      />
                    </label>
                    <label>
                      Phiên giao dịch
                      <select
                        value={draft.session}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            session: e.target.value as Trade["session"],
                          })
                        }
                      >
                        <option>Châu Á</option>
                        <option>London</option>
                        <option>New York</option>
                      </select>
                    </label>
                    <label>
                      Khung thời gian
                      <select
                        value={draft.timeframe}
                        onChange={(e) =>
                          setDraft({ ...draft, timeframe: e.target.value })
                        }
                      >
                        {![
                          "Auto",
                          "M1",
                          "M5",
                          "M15",
                          "M30",
                          "H1",
                          "H4",
                          "Daily",
                          "Weekly",
                        ].includes(draft.timeframe) && (
                          <option value={draft.timeframe}>
                            {draft.timeframe}
                          </option>
                        )}
                        <option>Auto</option>
                        <option>M1</option>
                        <option>M5</option>
                        <option>M15</option>
                        <option>M30</option>
                        <option>H1</option>
                        <option>H4</option>
                        <option>Daily</option>
                        <option>Weekly</option>
                      </select>
                    </label>
                    <label>
                      Hướng lệnh
                      <div
                        className="side-switch"
                        role="group"
                        aria-label="Hướng giao dịch"
                      >
                        <button
                          type="button"
                          className={draft.side === "Buy" ? "active buy" : ""}
                          aria-pressed={draft.side === "Buy"}
                          onClick={() => setDraft({ ...draft, side: "Buy" })}
                        >
                          Buy
                        </button>
                        <button
                          type="button"
                          className={draft.side === "Sell" ? "active sell" : ""}
                          aria-pressed={draft.side === "Sell"}
                          onClick={() => setDraft({ ...draft, side: "Sell" })}
                        >
                          Sell
                        </button>
                      </div>
                    </label>
                    <label className="span-two">
                      Setup / Playbook *
                      <select
                        value={draft.setup}
                        onChange={(e) =>
                          setDraft({ ...draft, setup: e.target.value })
                        }
                      >
                        {draft.setup !== UNCLASSIFIED_SETUP &&
                          !SETUP_OPTIONS.includes(draft.setup) && (
                            <option value={draft.setup}>{draft.setup}</option>
                          )}
                        <option>{UNCLASSIFIED_SETUP}</option>
                        {SETUP_GROUPS.map((group) => (
                          <optgroup label={group.label} key={group.label}>
                            {group.options.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <small>
                        Chọn đúng tên setup để dữ liệu phân tích không bị pha
                        trộn.
                      </small>
                    </label>
                    <label>
                      Tâm lý khi vào lệnh
                      <select
                        value={draft.psychology}
                        onChange={(e) =>
                          setDraft({ ...draft, psychology: e.target.value })
                        }
                      >
                        <option>Chưa review</option>
                        <option>Bình tĩnh</option>
                        <option>Tự tin</option>
                        <option>Trung lập</option>
                        <option>Hơi vội</option>
                        <option>FOMO</option>
                        <option>Căng thẳng</option>
                        <option>Trả thù</option>
                      </select>
                    </label>
                    <label className="span-three">
                      Nguồn dữ liệu
                      <select
                        value={draft.source}
                        onChange={(e) =>
                          setDraft({ ...draft, source: e.target.value })
                        }
                      >
                        {![
                          "Thủ công",
                          "TradingView",
                          "CSV · Broker VN",
                          "MetaTrader 5",
                          "Binance",
                          "Bybit",
                          "CQG / MXV",
                          "Webhook tự động",
                        ].includes(draft.source) && (
                          <option value={draft.source}>{draft.source}</option>
                        )}
                        <option>Thủ công</option>
                        <option>TradingView</option>
                        <option>CSV · Broker VN</option>
                        <option>MetaTrader 5</option>
                        <option>Binance</option>
                        <option>Bybit</option>
                        <option>CQG / MXV</option>
                        <option>Webhook tự động</option>
                      </select>
                    </label>
                  </div>
                </section>
                <section className="form-section">
                  <div className="form-section-title">
                    <span>02</span>
                    <div>
                      <h3>Kế hoạch giá & rủi ro</h3>
                      <p>Ghi trước điểm vô hiệu và lợi nhuận kỳ vọng</p>
                    </div>
                  </div>
                  <div className="form-grid three">
                    <label>
                      Rủi ro dự kiến (VNĐ) *
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="any"
                        value={draft.risk}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            risk: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="Ví dụ: 1.000.000"
                        required={!assetInput.enabled}
                      />
                      <small>Số tiền chấp nhận mất nếu SL bị chạm.</small>
                    </label>
                    <label>
                      {JournalForm.profiles[assetInput.asset_class].quantity}
                      <input
                        type="number"
                        inputMode="decimal"
                        step={assetInput.quantity_step||JournalForm.profiles[assetInput.asset_class].step}
                        min="0"
                        value={draft.quantity}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            quantity: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="0.1 / 500"
                      />
                    </label>
                    <label>
                      Giá vào
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={draft.entryPrice}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            entryPrice: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="Entry"
                      />
                    </label>
                    <label>
                      Giá cắt lỗ (SL)
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={draft.stopLoss}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            stopLoss: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="Invalidation"
                      />
                    </label>
                    <label>
                      Giá chốt lời (TP)
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={draft.takeProfit}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            takeProfit: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="Target"
                      />
                    </label>
                    <div
                      className={`planned-rr-card ${draftPlannedRr !== null && draftPlannedRr >= 2 ? "ready" : ""}`}
                    >
                      <span>R:R KẾ HOẠCH</span>
                      <strong>
                        {draftPlannedRr === null
                          ? "—"
                          : `1:${draftPlannedRr.toFixed(2)}`}
                      </strong>
                      <small>
                        {!draftHasPricePlan
                          ? "Nhập Entry, SL và TP"
                          : draftPlannedRr === null
                            ? `Kiểm tra vị trí giá cho lệnh ${draft.side}`
                            : draftPlannedRr >= 2
                              ? "Đạt ngưỡng kỳ vọng"
                              : "Dưới ngưỡng 1:2"}
                      </small>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <div className="form-section-title">
                    <span>03</span>
                    <div>
                      <h3>Kết quả thực tế</h3>
                      <p>
                        Tách P&L trước phí và chi phí để giữ số liệu nhất quán
                      </p>
                    </div>
                  </div>
                  <div className="form-grid four">
                    <label>
                      MAE trong lệnh (VNĐ, tùy chọn)
                      <input
                        type="number"
                        value={draft.mae ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            mae:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      MFE trong lệnh (VNĐ, tùy chọn)
                      <input
                        type="number"
                        value={draft.mfe ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            mfe:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      P&L trước phí (VNĐ) *
                      <input
                        type="number"
                        inputMode="numeric"
                        step="any"
                        value={draft.pnl}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            pnl: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="Lãi dương, lỗ âm"
                        required={!assetInput.enabled}
                      />
                    </label>
                    <label>
                      Phí giao dịch (VNĐ)
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="any"
                        value={draft.fees}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            fees: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="0"
                      />
                    </label>
                    <label>
                      Giá thoát
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={draft.exitPrice}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            exitPrice: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="Exit"
                      />
                    </label>
                    <label>
                      Thời gian giữ (phút)
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={draft.durationMin}
                        onFocus={selectNumericInput}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            durationMin: normalizeNumericInput(e.target.value),
                          })
                        }
                        placeholder="Ví dụ: 90"
                      />
                    </label>
                  </div>
                  <div className="trade-result-preview">
                    <article>
                      <span>P&L RÒNG SAU PHÍ</span>
                      <strong
                        className={
                          draftNetPnl === null
                            ? ""
                            : draftNetPnl >= 0
                              ? "positive-text"
                              : "negative-text"
                        }
                      >
                        {draftNetPnl === null ? "—" : money(draftNetPnl)}
                      </strong>
                    </article>
                    <article>
                      <span>KẾT QUẢ THEO R</span>
                      <strong
                        className={
                          draftActualR === null
                            ? ""
                            : draftActualR >= 0
                              ? "positive-text"
                              : "negative-text"
                        }
                      >
                        {draftActualR === null
                          ? "—"
                          : `${draftActualR >= 0 ? "+" : ""}${draftActualR.toFixed(2)}R`}
                      </strong>
                    </article>
                    <article>
                      <span>PHÂN LOẠI</span>
                      <strong>
                        {draftNetPnl === null
                          ? "Chưa có kết quả"
                          : draftNetPnl > 0
                            ? "Lệnh thắng"
                            : draftNetPnl < 0
                              ? "Lệnh thua"
                              : "Hòa vốn"}
                      </strong>
                    </article>
                  </div>
                </section>
                <section className="form-section">
                  <div className="form-section-title">
                    <span>04</span>
                    <div>
                      <h3>Checklist kỷ luật</h3>
                      <p>Chấm chất lượng quyết định độc lập với lời hoặc lỗ</p>
                    </div>
                    <strong className="discipline-live-score">
                      {draftDiscipline}%
                    </strong>
                  </div>
                  <div className="check-grid professional-check-grid">
                    {(
                      [
                        [
                          "plan",
                          "Đúng setup & kế hoạch",
                          "Có luận điểm, entry, invalidation và target rõ ràng",
                        ],
                        [
                          "noFomo",
                          "Chờ đúng tín hiệu",
                          "Không đuổi giá, không vào sớm vì FOMO",
                        ],
                        [
                          "noRevenge",
                          "Đúng rủi ro & quản lý",
                          "Không nới SL, gồng lỗ hoặc trả thù thị trường",
                        ],
                        [
                          "screenshot",
                          "Đủ bằng chứng",
                          "Có ảnh trước và sau lệnh để review",
                        ],
                      ] as const
                    ).map(([key, label, description]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={draft[key]}
                          onChange={(e) =>
                            setDraft({ ...draft, [key]: e.target.checked })
                          }
                        />
                        <span>✓</span>
                        <p>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </p>
                      </label>
                    ))}
                  </div>
                </section>
                <section className="form-section">
                  <div className="form-section-title">
                    <span>05</span>
                    <div>
                      <h3>Bằng chứng & review</h3>
                      <p>
                        Lưu ảnh, đối chiếu kế hoạch và chốt một hành động cải
                        thiện
                      </p>
                    </div>
                  </div>
                  <div className="evidence-review-grid">
                    <div>
                      <label className="trade-image-drop">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={selectDraftImages}
                        />
                        <ImagePlus size={22} />
                        <strong>
                          {draftImages.length
                            ? `Đã chọn ${draftImages.length}/4 ảnh`
                            : "Thêm ảnh trước / sau lệnh"}
                        </strong>
                        <span>JPG, PNG, WEBP · tối đa 6 MB/ảnh</span>
                      </label>
                      {draftImagePreviews.length > 0 && (
                        <div className="draft-image-grid">
                          {draftImagePreviews.map((preview, index) => (
                            <figure
                              key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                            >
                              <img
                                src={preview.url}
                                alt={`Ảnh xem trước ${index + 1}`}
                              />
                              <figcaption>
                                <span>{preview.file.name}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftImages((current) =>
                                      current.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    )
                                  }
                                  aria-label={`Bỏ ảnh ${preview.file.name}`}
                                >
                                  ×
                                </button>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="trade-review-field">
                      <div>
                        <label htmlFor="trade-review-note">
                          Review giao dịch
                        </label>
                        <button
                          type="button"
                          onClick={insertTradeReviewTemplate}
                        >
                          <BookOpen size={14} /> Chèn khung review
                        </button>
                      </div>
                      <textarea
                        id="trade-review-note"
                        value={draft.note}
                        onChange={(e) =>
                          setDraft({ ...draft, note: e.target.value })
                        }
                        placeholder="Ghi dữ kiện, sai lệch, bài học và một hành động cụ thể..."
                      />
                      <small>
                        Không thay đổi hệ thống chỉ vì một lệnh; hãy ghi điều có
                        thể kiểm chứng.
                      </small>
                    </div>
                  </div>
                </section>
              </div>
              <aside
                className="trade-form-summary"
                aria-label="Tóm tắt giao dịch"
              >
                <div className="trade-summary-head">
                  <span className="eyebrow">TRADE SNAPSHOT</span>
                  <strong>
                    {draft.symbol.trim().toUpperCase() || "CHƯA NHẬP MÃ"}
                  </strong>
                  <small>
                    {draft.market} · {draft.side} · {draft.timeframe}
                  </small>
                </div>
                <span
                  className={`trade-ready-state ${draftReady ? "ready" : "pending"}`}
                >
                  <i />
                  {draftReady
                    ? "Đủ dữ liệu bắt buộc"
                    : "Cần hoàn thiện dữ liệu"}
                </span>
                <div className="trade-summary-metrics">
                  <article>
                    <span>R:R kế hoạch</span>
                    <strong>
                      {draftPlannedRr === null
                        ? "—"
                        : `1:${draftPlannedRr.toFixed(2)}`}
                    </strong>
                  </article>
                  <article>
                    <span>Kết quả</span>
                    <strong>
                      {draftActualR === null
                        ? "—"
                        : `${draftActualR >= 0 ? "+" : ""}${draftActualR.toFixed(2)}R`}
                    </strong>
                  </article>
                  <article>
                    <span>Kỷ luật</span>
                    <strong>{draftDiscipline}%</strong>
                  </article>
                  <article>
                    <span>Hồ sơ</span>
                    <strong>{draftCompleteness}%</strong>
                  </article>
                </div>
                <div className="trade-summary-checks">
                  <span>KIỂM TRA TRƯỚC KHI LƯU</span>
                  {[
                    [
                      Boolean(draft.date && draft.symbol.trim()),
                      "Ngày và sản phẩm",
                    ],
                    [draft.setup !== UNCLASSIFIED_SETUP, "Setup đã phân loại"],
                    [
                      Number.isFinite(draftRiskValue) && draftRiskValue > 0,
                      "Rủi ro dự kiến hợp lệ",
                    ],
                    [
                      draftPnlValue !== null && Number.isFinite(draftPnlValue),
                      "P&L trước phí",
                    ],
                    [
                      draftHasPricePlan && draftPlannedRr !== null,
                      "Entry · SL · TP hợp lệ",
                    ],
                    [
                      draft.screenshot || draftImages.length > 0,
                      "Ảnh trước / sau lệnh",
                    ],
                    [Boolean(draft.note.trim()), "Review có hành động"],
                  ].map(([done, label]) => (
                    <div className={done ? "done" : ""} key={String(label)}>
                      <i>{done ? "✓" : "·"}</i>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="trade-summary-principle">
                  <ShieldCheck size={16} />
                  <p>
                    <span>NGUYÊN TẮC</span>
                    <strong>
                      Chất lượng hồ sơ quan trọng hơn việc cố làm đẹp kết quả.
                    </strong>
                  </p>
                </div>
              </aside>
            </div>
            <div className="modal-actions professional-modal-actions">
              <div>
                <span className={draftReady ? "ready" : ""}>
                  <i />
                  {draftReady ? "Sẵn sàng lưu" : "Còn thiếu trường bắt buộc"}
                </span>
                <small>{draftCompleteness}% độ hoàn thiện hồ sơ</small>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingTradeId(null);
                }}
              >
                Hủy
              </button>
              <button type="submit" className="gold-button compact">
                {editingTradeId ? "Lưu thay đổi" : "Lưu giao dịch"}
              </button>
            </div>
          </form>
        </div>
      )}
      {connectProvider && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConnectProvider(null);
              setWebhookToken("");
            }
          }}
        >
          <form
            className="connection-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-dialog-title"
            onSubmit={saveConnection}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">BROKER CONNECTION</span>
                <h2 id="connection-dialog-title">
                  {
                    BROKERS.find(
                      (broker) => broker.provider === connectProvider,
                    )?.name
                  }
                </h2>
                <p>
                  {
                    BROKERS.find(
                      (broker) => broker.provider === connectProvider,
                    )?.mode
                  }
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setConnectProvider(null);
                  setWebhookToken("");
                }}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            {connectProvider === "webhook" ? (
              <div className="connection-body">
                {webhookToken ? (
                  <>
                    <div className="connection-notice amber">
                      <KeyRound size={18} />
                      <div>
                        <strong>Lưu token ngay — chỉ hiển thị một lần</strong>
                        <p>
                          Nếu mất token, hãy tạo token mới; token cũ sẽ ngừng
                          hoạt động.
                        </p>
                      </div>
                    </div>
                    <div className="webhook-token-box">
                      <span>BEARER TOKEN</span>
                      <code>{webhookToken}</code>
                      <button
                        type="button"
                        onClick={() => void copyWebhookToken()}
                      >
                        <Copy size={15} /> Sao chép token
                      </button>
                    </div>
                    <label className="code-label">
                      Endpoint nhận lệnh<pre>POST {WEBHOOK_ENDPOINT}</pre>
                    </label>
                    <p className="connection-help">
                      Bridge gửi header <b>Authorization: Bearer TOKEN</b>. Mỗi
                      lệnh cần externalId, market và symbol; hệ thống chống nhập
                      trùng theo mã lệnh.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="connection-notice">
                      <KeyRound size={18} />
                      <div>
                        <strong>Một token riêng cho bridge giao dịch</strong>
                        <p>
                          Token chỉ dùng để ghi lệnh vào journal, không có quyền
                          đọc dữ liệu hoặc đặt lệnh broker.
                        </p>
                      </div>
                    </div>
                    <label>
                      Tên kết nối
                      <input
                        value={connectionDraft.label}
                        onChange={(e) =>
                          setConnectionDraft({
                            ...connectionDraft,
                            label: e.target.value,
                          })
                        }
                        placeholder="Ví dụ: Bridge broker riêng"
                        required
                      />
                    </label>
                    <div className="webhook-flow">
                      <div>
                        <b>Broker / sàn</b>
                        <span>Khớp hoặc đóng lệnh</span>
                      </div>
                      <i>→</i>
                      <div>
                        <b>Bridge</b>
                        <span>Chuẩn hóa JSON</span>
                      </div>
                      <i>→</i>
                      <div>
                        <b>Journal</b>
                        <span>Tự chống trùng</span>
                      </div>
                    </div>
                    <label className="code-label">
                      Mẫu payload
                      <pre>{`{
  "externalId": "deal-123456",
  "market": "Forex",
  "symbol": "EURUSD",
  "side": "BUY",
  "closedAt": "2026-08-08T09:30:00Z",
  "pnl": 1250000,
  "fees": 45000,
  "quantity": 0.2,
  "entryPrice": 1.1625,
  "exitPrice": 1.1649
}`}</pre>
                    </label>
                    <p className="connection-help">
                      Market nhận: Chứng khoán, Forex, Crypto và Hàng hóa. Có
                      thể gửi một lệnh, một mảng hoặc {`{"trades": [...]}`} tối
                      đa 500 lệnh/lần.
                    </p>
                  </>
                )}
              </div>
            ) : isBridgeProvider(connectProvider) ? (
              <div className="connection-body">
                {webhookToken ? (
                  <>
                    <div className="connection-notice amber">
                      <KeyRound size={18} />
                      <div>
                        <strong>
                          Lưu token {BRIDGE_DETAILS[connectProvider].source}{" "}
                          ngay
                        </strong>
                        <p>
                          Token chỉ hiển thị lần này. Tạo token mới sẽ vô hiệu
                          token cũ.
                        </p>
                      </div>
                    </div>
                    <div className="webhook-token-box">
                      <span>BEARER TOKEN</span>
                      <code>{webhookToken}</code>
                      <button
                        type="button"
                        onClick={() => void copyWebhookToken()}
                      >
                        <Copy size={15} /> Sao chép token
                      </button>
                    </div>
                    <label className="code-label">
                      Endpoint Push 24/7<pre>POST {WEBHOOK_ENDPOINT}</pre>
                    </label>
                    <p className="connection-help">
                      Gửi header <b>Authorization: Bearer TOKEN</b>. Với{" "}
                      {BRIDGE_DETAILS[connectProvider].source}, market mặc định
                      là <b>{BRIDGE_DETAILS[connectProvider].market}</b>; chỉ
                      cần externalId và symbol để định danh lệnh.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="connection-notice">
                      <ShieldCheck size={18} />
                      <div>
                        <strong>
                          Bridge tách biệt khỏi tài khoản giao dịch
                        </strong>
                        <p>{BRIDGE_DETAILS[connectProvider].notice}</p>
                      </div>
                    </div>
                    <label>
                      Tên kết nối
                      <input
                        value={connectionDraft.label}
                        onChange={(e) =>
                          setConnectionDraft({
                            ...connectionDraft,
                            label: e.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <div
                      className="sync-mode-options"
                      role="group"
                      aria-label="Chọn chế độ đồng bộ"
                    >
                      <button
                        type="button"
                        className={
                          connectionDraft.accountType === "push" ? "active" : ""
                        }
                        onClick={() =>
                          setConnectionDraft({
                            ...connectionDraft,
                            accountType: "push",
                          })
                        }
                      >
                        <strong>Push 24/7</strong>
                        <span>Khuyên dùng · bridge chủ động gửi</span>
                      </button>
                      <button
                        type="button"
                        className={
                          connectionDraft.accountType === "pull" ? "active" : ""
                        }
                        onClick={() =>
                          setConnectionDraft({
                            ...connectionDraft,
                            accountType: "pull",
                          })
                        }
                      >
                        <strong>Pull bridge</strong>
                        <span>Kiểm tra khi mở app + mỗi 15 phút</span>
                      </button>
                    </div>
                    {connectionDraft.accountType === "push" ? (
                      <>
                        {BRIDGE_DETAILS[connectProvider].foreignCurrency && (
                          <label>
                            Tỷ giá tiền tài khoản → VNĐ
                            <input
                              type="number"
                              min="1"
                              value={connectionDraft.fxRate}
                              onFocus={selectNumericInput}
                              onChange={(e) =>
                                setConnectionDraft({
                                  ...connectionDraft,
                                  fxRate: normalizeNumericInput(e.target.value),
                                })
                              }
                            />
                            <small>
                              P/L, risk và phí từ bridge sẽ được nhân với tỷ giá
                              này.
                            </small>
                          </label>
                        )}
                        <div className="webhook-flow">
                          <div>
                            <b>{BRIDGE_DETAILS[connectProvider].source}</b>
                            <span>Lệnh đã khớp/đóng</span>
                          </div>
                          <i>→</i>
                          <div>
                            <b>Bridge 24/7</b>
                            <span>Gửi JSON bảo mật</span>
                          </div>
                          <i>→</i>
                          <div>
                            <b>Journal</b>
                            <span>Chống trùng tự động</span>
                          </div>
                        </div>
                        <label className="code-label">
                          Payload tối thiểu mở rộng
                          <pre>{bridgePayloadExample(connectProvider)}</pre>
                        </label>
                        <p className="connection-help">
                          Sau khi lưu, app cấp một token ghi dữ liệu riêng.
                          Bridge có thể gửi một object, một mảng hoặc{" "}
                          {`{"trades": [...]}`} tối đa 500 lệnh/lần.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="form-grid two">
                          <label>
                            Bridge HTTPS
                            <input
                              type="url"
                              value={connectionDraft.bridgeUrl}
                              onChange={(e) =>
                                setConnectionDraft({
                                  ...connectionDraft,
                                  bridgeUrl: e.target.value,
                                })
                              }
                              placeholder="https://bridge-cua-ban.example/trades"
                              required
                            />
                          </label>
                          <label>
                            Bridge token
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={connectionDraft.bridgeToken}
                              onChange={(e) =>
                                setConnectionDraft({
                                  ...connectionDraft,
                                  bridgeToken: e.target.value,
                                })
                              }
                              required
                            />
                          </label>
                        </div>
                        {BRIDGE_DETAILS[connectProvider].foreignCurrency && (
                          <label>
                            Tỷ giá tiền tài khoản → VNĐ
                            <input
                              type="number"
                              min="1"
                              value={connectionDraft.fxRate}
                              onFocus={selectNumericInput}
                              onChange={(e) =>
                                setConnectionDraft({
                                  ...connectionDraft,
                                  fxRate: normalizeNumericInput(e.target.value),
                                })
                              }
                            />
                            <small>
                              P/L, risk và phí từ bridge sẽ được nhân với tỷ giá
                              này.
                            </small>
                          </label>
                        )}
                        <label className="code-label">
                          Response bridge được chấp nhận
                          <pre>{`[{ ...trade }]
hoặc
{ "trades": [{ ...trade }] }`}</pre>
                        </label>
                        <p className="connection-help">
                          Journal gọi endpoint HTTPS với header Bearer, nhận tối
                          đa 1.000 lệnh/lần và tự chống trùng bằng externalId.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : connectProvider === "tradingview" ? (
              <div className="connection-body">
                <div className="connection-notice amber">
                  <span>!</span>
                  <div>
                    <strong>TradingView gửi alert bằng webhook</strong>
                    <p>
                      Dùng Auto Import Hub làm endpoint bảo mật. Không đưa mật
                      khẩu broker vào nội dung alert.
                    </p>
                  </div>
                </div>
                <div className="webhook-flow">
                  <div>
                    <b>TradingView</b>
                    <span>Alert JSON</span>
                  </div>
                  <i>→</i>
                  <div>
                    <b>Bridge</b>
                    <span>Ghép kết quả lệnh</span>
                  </div>
                  <i>→</i>
                  <div>
                    <b>Tuan Trader</b>
                    <span>Gắn vào journal</span>
                  </div>
                </div>
                <label className="code-label">
                  Mẫu JSON alert
                  <pre>{`{
  "symbol": "{{ticker}}",
  "side": "BUY",
  "price": "{{close}}",
  "time": "{{timenow}}",
  "market": "Crypto"
}`}</pre>
                </label>
                <p className="connection-help">
                  Alert là tín hiệu; kết quả P/L nên lấy từ execution của
                  Binance, Bybit, MT5 hoặc bridge broker để tránh ghi nhận sai.
                </p>
              </div>
            ) : connectProvider === "vn-broker" ? (
              <div className="connection-body">
                <div className="connection-notice">
                  <span>CSV</span>
                  <div>
                    <strong>Định dạng được nhận tự động</strong>
                    <p>
                      App dò các cột tương đương: ngày, mã, mua/bán, khối lượng,
                      giá, phí và lãi/lỗ.
                    </p>
                  </div>
                </div>
                <label>
                  Broker
                  <select
                    value={connectionDraft.brokerName}
                    onChange={(e) =>
                      setConnectionDraft({
                        ...connectionDraft,
                        brokerName: e.target.value,
                      })
                    }
                  >
                    <option>VPS</option>
                    <option>SSI</option>
                    <option>TCBS</option>
                    <option>VNDIRECT</option>
                    <option>MBS</option>
                    <option>HSC</option>
                    <option>Broker VN</option>
                  </select>
                </label>
                <label className="gold-button compact file-button large">
                  Chọn file CSV
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv"
                    multiple
                    data-market="Chứng khoán"
                    data-broker={connectionDraft.brokerName}
                    onChange={(event) => {
                      void importCsv(event);
                      setConnectProvider(null);
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="connection-body">
                <div className="connection-notice">
                  <span>◇</span>
                  <div>
                    <strong>Chỉ cấp quyền đọc lịch sử</strong>
                    <p>
                      Tắt quyền Trade và Withdraw. API secret được mã hóa trước
                      khi lưu.
                    </p>
                  </div>
                </div>
                <div className="form-grid two">
                  <label>
                    Tên kết nối
                    <input
                      value={connectionDraft.label}
                      onChange={(e) =>
                        setConnectionDraft({
                          ...connectionDraft,
                          label: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Loại tài khoản
                    <select
                      value={connectionDraft.accountType}
                      onChange={(e) =>
                        setConnectionDraft({
                          ...connectionDraft,
                          accountType: e.target.value,
                        })
                      }
                    >
                      <option
                        value={
                          connectProvider === "bybit" ? "linear" : "futures"
                        }
                      >
                        Phái sinh / Futures
                      </option>
                      <option value="spot">Spot</option>
                    </select>
                  </label>
                </div>
                <>
                  <div className="form-grid two">
                    <label>
                      API key
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={connectionDraft.apiKey}
                        onChange={(e) =>
                          setConnectionDraft({
                            ...connectionDraft,
                            apiKey: e.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label>
                      API secret
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={connectionDraft.apiSecret}
                        onChange={(e) =>
                          setConnectionDraft({
                            ...connectionDraft,
                            apiSecret: e.target.value,
                          })
                        }
                        required
                      />
                    </label>
                  </div>
                  {connectProvider === "binance" && (
                    <label>
                      Symbols cần đồng bộ
                      <input
                        value={connectionDraft.symbols}
                        onChange={(e) =>
                          setConnectionDraft({
                            ...connectionDraft,
                            symbols: e.target.value,
                          })
                        }
                        placeholder="BTCUSDT, ETHUSDT"
                      />
                    </label>
                  )}
                </>
                <label>
                  Tỷ giá USD/USDT → VNĐ
                  <input
                    type="number"
                    min="1"
                    value={connectionDraft.fxRate}
                    onFocus={selectNumericInput}
                    onChange={(e) =>
                      setConnectionDraft({
                        ...connectionDraft,
                        fxRate: normalizeNumericInput(e.target.value),
                      })
                    }
                  />
                  <small>
                    Dùng để hợp nhất P/L crypto và forex vào dashboard VNĐ.
                  </small>
                </label>
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setConnectProvider(null);
                  setWebhookToken("");
                }}
              >
                {webhookToken ? "Đóng" : "Hủy"}
              </button>
              {connectProvider === "tradingview" ? (
                <button type="submit" className="gold-button compact">
                  Đã hiểu
                </button>
              ) : connectProvider === "webhook" ||
                (isBridgeProvider(connectProvider) &&
                  connectionDraft.accountType === "push") ? (
                webhookToken ? (
                  <button
                    type="button"
                    className="gold-button compact"
                    onClick={() => {
                      setConnectProvider(null);
                      setWebhookToken("");
                    }}
                  >
                    Đã lưu token
                  </button>
                ) : (
                  <button type="submit" className="gold-button compact">
                    {connectProvider === "webhook"
                      ? "Tạo khóa bảo mật"
                      : "Tạo kết nối & token"}
                  </button>
                )
              ) : (
                connectProvider !== "vn-broker" && (
                  <button type="submit" className="gold-button compact">
                    Lưu kết nối
                  </button>
                )
              )}
            </div>
          </form>
        </div>
      )}
      {activeImage && (
        <div
          className="image-viewer-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveImage(null);
          }}
        >
          <section
            className="image-viewer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-viewer-title"
          >
            <header>
              <div>
                <span className="eyebrow">ẢNH GIAO DỊCH</span>
                <h2 id="image-viewer-title">
                  {activeImageTrade?.symbol ?? "Biểu đồ"} ·{" "}
                  {activeImageTrade?.side ?? ""}
                </h2>
                <p>
                  {activeImageTrade
                    ? DATE.format(new Date(`${activeImageTrade.date}T12:00:00`))
                    : ""}{" "}
                  · {activeImage.filename}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveImage(null)}
                aria-label="Đóng ảnh"
              >
                ×
              </button>
            </header>
            <div className="image-viewer-stage">
              <img
                src={activeImage.url}
                alt={`Biểu đồ ${activeImageTrade?.symbol ?? "giao dịch"}`}
              />
            </div>
            {activeImageSiblings.length > 1 && (
              <div className="image-viewer-thumbs">
                {activeImageSiblings.map((image) => (
                  <button
                    type="button"
                    className={image.id === activeImage.id ? "active" : ""}
                    key={image.id}
                    onClick={() => setActiveImage(image)}
                  >
                    <img src={image.url} alt={image.filename} />
                  </button>
                ))}
              </div>
            )}
            <footer>
              <span>
                {(activeImage.sizeBytes / 1024 / 1024).toFixed(1)} MB · lưu
                riêng tư
              </span>
              <button
                type="button"
                className="image-delete-button"
                onClick={() => void deleteTradeImage(activeImage)}
              >
                <Trash2 size={15} /> Xóa ảnh
              </button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
