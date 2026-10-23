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
import CompanyValuation from "./components/CompanyValuation";
import EquityTimeChart, { type EquityChartPoint } from "./components/EquityTimeChart";
import SystemTracker from "./components/SystemTracker";
import TradingMetrix from "./components/TradingMetrix";
import { normalizeNumericInput, selectNumericInput } from "./components/numeric-input";
import { authClient } from "../../lib/auth-client";
import { parseBinanceFuturesText, type BinanceImportedTrade } from "../../lib/binance-import";
import { parseTradeCsv, parseTradeWorkbook } from "../../lib/trade-import";

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
type Provider = BridgeProvider | "binance" | "bybit" | "tradingview" | "vn-broker" | "webhook";
type AnalyticsTab = "symbol" | "setup" | "session" | "weekday" | "heatmap";

type Trade = {
  id: string;
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

type DraftTrade = Omit<Trade, "id" | "discipline" | "durationMin" | "market" | "source" | "risk" | "pnl" | "fees" | "quantity" | "entryPrice" | "stopLoss" | "takeProfit" | "exitPrice"> & {
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
  { id: "T260710", date: "2026-07-10", symbol: "BẠC", side: "Buy", session: "New York", setup: "Breakout + Retest", timeframe: "H1", risk: 1200000, pnl: 2800000, discipline: 100, psychology: "Bình tĩnh", note: "Chờ giá retest vùng phá vỡ, khối lượng xác nhận.", durationMin: 185 },
  { id: "T260713", date: "2026-07-13", symbol: "DẦU WTI", side: "Sell", session: "New York", setup: "Từ chối giá", timeframe: "M30", risk: 1100000, pnl: -1100000, discipline: 75, psychology: "Hơi vội", note: "Vào sớm trước tín hiệu xác nhận.", durationMin: 72 },
  { id: "T260715", date: "2026-07-15", symbol: "ROBUSTA", side: "Buy", session: "London", setup: "Pullback xu hướng", timeframe: "H1", risk: 1300000, pnl: 2150000, discipline: 100, psychology: "Bình tĩnh", note: "Giữ đúng kế hoạch, chốt tại vùng cung gần nhất.", durationMin: 246 },
  { id: "T260717", date: "2026-07-17", symbol: "ĐẬU TƯƠNG", side: "Sell", session: "Châu Á", setup: "Phá cấu trúc", timeframe: "H4", risk: 900000, pnl: 0, discipline: 100, psychology: "Trung lập", note: "Dời hòa vốn khi giá đạt 1R.", durationMin: 390 },
  { id: "T260720", date: "2026-07-20", symbol: "ĐỒNG", side: "Buy", session: "London", setup: "Breakout + Retest", timeframe: "M30", risk: 1000000, pnl: 1800000, discipline: 100, psychology: "Tự tin", note: "Setup rõ, tỷ lệ R:R tốt.", durationMin: 128 },
  { id: "T260722", date: "2026-07-22", symbol: "BẠC", side: "Sell", session: "New York", setup: "Từ chối giá", timeframe: "M15", risk: 1250000, pnl: -1250000, discipline: 50, psychology: "FOMO", note: "Giao dịch ngoài khung giờ kế hoạch.", durationMin: 34 },
  { id: "T260724", date: "2026-07-24", symbol: "DẦU WTI", side: "Buy", session: "New York", setup: "Pullback xu hướng", timeframe: "H1", risk: 1150000, pnl: 2450000, discipline: 100, psychology: "Bình tĩnh", note: "Không đuổi giá, chờ vùng cầu.", durationMin: 211 },
  { id: "T260727", date: "2026-07-27", symbol: "ROBUSTA", side: "Sell", session: "London", setup: "Phá cấu trúc", timeframe: "H1", risk: 1050000, pnl: -620000, discipline: 75, psychology: "Trung lập", note: "Đóng sớm khi cấu trúc ngắn hạn thay đổi.", durationMin: 156 },
  { id: "T260729", date: "2026-07-29", symbol: "NGÔ", side: "Buy", session: "Châu Á", setup: "Tích lũy", timeframe: "H4", risk: 800000, pnl: 1520000, discipline: 100, psychology: "Bình tĩnh", note: "Khối lượng tăng tại đáy vùng giá trị.", durationMin: 510 },
  { id: "T260801", date: "2026-08-01", symbol: "BẠC", side: "Buy", session: "New York", setup: "Breakout + Retest", timeframe: "H1", risk: 1200000, pnl: 3200000, discipline: 100, psychology: "Bình tĩnh", note: "Lệnh A+, đủ checklist.", durationMin: 198 },
  { id: "T260803", date: "2026-08-03", symbol: "DẦU WTI", side: "Sell", session: "New York", setup: "Từ chối giá", timeframe: "M30", risk: 1200000, pnl: -1200000, discipline: 75, psychology: "Căng thẳng", note: "Khối lượng nhỏ đúng mức rủi ro.", durationMin: 88 },
  { id: "T260804", date: "2026-08-04", symbol: "ĐỒNG", side: "Buy", session: "London", setup: "Pullback xu hướng", timeframe: "H1", risk: 1000000, pnl: 1950000, discipline: 100, psychology: "Tự tin", note: "Giữ lệnh theo trailing swing low.", durationMin: 275 },
  { id: "T260805", date: "2026-08-05", symbol: "ĐẬU TƯƠNG", side: "Sell", session: "Châu Á", setup: "Phá cấu trúc", timeframe: "H4", risk: 900000, pnl: -900000, discipline: 100, psychology: "Bình tĩnh", note: "Thua đúng kế hoạch, không vào lại.", durationMin: 340 },
  { id: "T260806", date: "2026-08-06", symbol: "ROBUSTA", side: "Buy", session: "London", setup: "Tích lũy", timeframe: "H1", risk: 1100000, pnl: 2640000, discipline: 100, psychology: "Bình tĩnh", note: "Tín hiệu volume xác nhận ngay vùng hỗ trợ.", durationMin: 224 },
  { id: "S260728", date: "2026-07-28", symbol: "FPT", side: "Buy", session: "Châu Á", setup: "Breakout nền giá", timeframe: "Daily", risk: 1500000, pnl: 3100000, discipline: 100, psychology: "Bình tĩnh", note: "Cổ phiếu dẫn dắt, thanh khoản xác nhận.", durationMin: 4320, market: "Chứng khoán", source: "CSV · Broker VN", quantity: 500, fees: 180000 },
  { id: "S260805", date: "2026-08-05", symbol: "SSI", side: "Buy", session: "Châu Á", setup: "Pullback xu hướng", timeframe: "Daily", risk: 1200000, pnl: -850000, discipline: 100, psychology: "Bình tĩnh", note: "Cắt lỗ đúng ngưỡng khi mất hỗ trợ.", durationMin: 2880, market: "Chứng khoán", source: "CSV · Broker VN", quantity: 1000, fees: 145000 },
  { id: "C260730", date: "2026-07-30", symbol: "BTCUSDT", side: "Buy", session: "New York", setup: "Breakout + Retest", timeframe: "H4", risk: 1800000, pnl: 4250000, discipline: 100, psychology: "Bình tĩnh", note: "Binance Futures · dữ liệu minh họa.", durationMin: 560, market: "Crypto", source: "Binance", quantity: 0.035, fees: 92000 },
  { id: "C260804", date: "2026-08-04", symbol: "ETHUSDT", side: "Sell", session: "New York", setup: "Từ chối giá", timeframe: "H1", risk: 1000000, pnl: -1000000, discipline: 75, psychology: "Hơi vội", note: "Bybit · dữ liệu minh họa.", durationMin: 95, market: "Crypto", source: "Bybit", quantity: 0.4, fees: 62000 },
  { id: "F260729", date: "2026-07-29", symbol: "EURUSD", side: "Buy", session: "London", setup: "Phá cấu trúc", timeframe: "H1", risk: 1000000, pnl: 2070000, discipline: 100, psychology: "Bình tĩnh", note: "MT5 · đóng tại vùng cung H4.", durationMin: 210, market: "Forex", source: "MetaTrader 5", quantity: 0.2, fees: 75000 },
  { id: "F260806", date: "2026-08-06", symbol: "XAUUSD", side: "Sell", session: "New York", setup: "Từ chối giá", timeframe: "M30", risk: 1300000, pnl: 2860000, discipline: 100, psychology: "Tự tin", note: "TradingView alert + MT5 execution.", durationMin: 135, market: "Forex", source: "TradingView", quantity: 0.1, fees: 110000 },
];

for (const trade of SAMPLE_TRADES) {
  trade.market ??= "Hàng hóa";
  trade.source ??= "Thủ công";
  trade.fees ??= 0;
  trade.quantity ??= 0;
}

const DEMO_STORAGE_KEY = "tuan-trader-demo-mode-v1";
const MIN_ANALYTICS_SAMPLE = 20;
const SAMPLE_TRADE_IDS = new Set(SAMPLE_TRADES.map((trade) => trade.id));

function isDemoDataset(source: Trade[]) {
  return source.length === SAMPLE_TRADES.length && source.every((trade) => SAMPLE_TRADE_IDS.has(trade.id));
}

type NavItem = { id: View; label: string; icon: LucideIcon };

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Nhật ký",
    items: [
      { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
      { id: "journal", label: "Nhật ký giao dịch", icon: BookOpen },
      { id: "calendar", label: "Lịch giao dịch", icon: CalendarDays },
      { id: "process", label: "Quy trình setup", icon: ListChecks },
      { id: "notes", label: "Ghi chú & review", icon: NotebookPen },
    ],
  },
  {
    label: "Phân tích",
    items: [
      { id: "analytics", label: "Lợi thế thống kê", icon: BarChart3 },
      { id: "risk", label: "Lợi nhuận & rủi ro", icon: ShieldCheck },
      { id: "statistics", label: "Trading MetriX", icon: Gauge },
      { id: "system-tracker", label: "Theo dõi hệ thống", icon: History },
    ],
  },
  {
    label: "Công cụ",
    items: [
      { id: "valuation", label: "Định giá doanh nghiệp", icon: Building2 },
      { id: "connections", label: "Kết nối dữ liệu", icon: PlugZap },
    ],
  },
  {
    label: "Hệ thống",
    items: [{ id: "settings", label: "Cài đặt & sao lưu", icon: Settings }],
  },
];

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  overview: { title: "Nhật ký giao dịch đa thị trường", subtitle: "Tổng quan hiệu suất · Kỷ luật · Quản trị rủi ro" },
  journal: { title: "Nhật ký giao dịch", subtitle: "Mỗi lệnh là một dữ liệu để bạn tiến bộ" },
  calendar: { title: "Lịch giao dịch", subtitle: "Nhìn lại nhịp độ và kết quả theo ngày" },
  analytics: { title: "Phân tích", subtitle: "Tìm lợi thế thật sự trong dữ liệu giao dịch" },
  risk: { title: "Lợi nhuận · Rủi ro", subtitle: "Bảo vệ vốn trước khi nghĩ đến lợi nhuận" },
  statistics: { title: "Trading MetriX", subtitle: "Mục tiêu · Equity · Giới hạn rủi ro · Hiệu suất chuyên sâu" },
  "system-tracker": { title: "Theo dõi hệ thống", subtitle: "Hồ sơ hiệu suất theo năm · Tự cập nhật từ 2026 về sau" },
  valuation: { title: "Định giá doanh nghiệp", subtitle: "9 mô hình · Kiểm tra chéo · Kỳ vọng thị trường · Xác suất" },
  pair: { title: "Hiệu suất sản phẩm", subtitle: "Sản phẩm nào đang tạo ra lợi thế?" },
  setup: { title: "Hiệu suất setup", subtitle: "Đo chất lượng từng mô hình giao dịch" },
  weekday: { title: "Hiệu suất theo thứ", subtitle: "Chọn đúng ngày để tập trung" },
  heatmap: { title: "Bản đồ nhiệt", subtitle: "Mật độ và hiệu suất theo ngày trong tuần" },
  process: { title: "Quy trình setup", subtitle: "Chuẩn hóa quyết định trước, trong và sau giao dịch" },
  notes: { title: "Ghi chú & review", subtitle: "Ghi sự thật, đánh giá quy trình và chốt hành động cải thiện" },
  connections: { title: "Kết nối broker", subtitle: "Hợp nhất dữ liệu từ sàn và nền tảng giao dịch" },
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

const BROKERS: { provider: Provider; name: string; badge: string; mode: string; copy: string; scope: string }[] = [
  { provider: "vps", name: "VPS", badge: "VP", mode: "Push 24/7 · Pull bridge", copy: "Nhận lịch sử khớp lệnh qua bridge cục bộ/đối tác, mặc định nhận diện chứng khoán.", scope: "✓ Cổ phiếu · Phái sinh VN" },
  { provider: "ssi", name: "SSI FastConnect", badge: "SSI", mode: "Push 24/7 · Pull bridge", copy: "Sẵn sàng cho bridge FastConnect; khóa ký và PIN/OTP luôn nằm ngoài journal.", scope: "✓ Cơ sở · Phái sinh SSI" },
  { provider: "tcx", name: "TCX / TCBS", badge: "TCX", mode: "Push 24/7 · Pull bridge", copy: "Nhận giao dịch TCX/TCBS qua bridge hoặc trình theo dõi statement tự động.", scope: "✓ Cổ phiếu · Trái phiếu" },
  { provider: "mt5", name: "MetaTrader 5", badge: "M5", mode: "Push 24/7 · Pull bridge", copy: "Bridge Python/EA đọc deal đã đóng từ terminal MT5 rồi tự cập nhật journal.", scope: "✓ Forex · CFD · Gold" },
  { provider: "cqg", name: "CQG", badge: "CQG", mode: "Push 24/7 · Pull bridge", copy: "Nhận execution và lịch sử lệnh từ CQG WebAPI qua bridge được broker cấp quyền.", scope: "✓ Futures · Hàng hóa" },
  { provider: "binance", name: "Binance", badge: "BN", mode: "API chỉ đọc", copy: "Đồng bộ Spot hoặc Futures theo danh sách symbol bạn chọn.", scope: "✓ Spot & phái sinh" },
  { provider: "bybit", name: "Bybit", badge: "BY", mode: "API chỉ đọc", copy: "Đồng bộ lịch sử execution của Spot hoặc USDT Perpetual.", scope: "✓ Spot & phái sinh" },
  { provider: "tradingview", name: "TradingView", badge: "TV", mode: "Alert workflow", copy: "Chuẩn bị payload alert để ghép tín hiệu với lệnh thực thi.", scope: "✓ Alert JSON" },
  { provider: "vn-broker", name: "Broker chứng khoán VN", badge: "VN", mode: "CSV đa định dạng", copy: "Nhập lịch sử từ VPS, SSI, TCBS, VNDIRECT, MBS và broker khác.", scope: "✓ Giao dịch cơ sở" },
  { provider: "webhook", name: "Auto Import Hub", badge: "AI", mode: "Webhook bảo mật", copy: "Nhận lệnh tự động từ broker, sàn hoặc công cụ trung gian khác.", scope: "✓ Stock · Forex · Coin · CQG" },
];

const BRIDGE_PROVIDERS: BridgeProvider[] = ["vps", "ssi", "tcx", "mt5", "cqg"];
const AUTO_SYNC_PROVIDERS: Provider[] = ["vps", "ssi", "tcx", "mt5", "cqg", "binance", "bybit"];
const UNCLASSIFIED_SETUP = "Chưa phân loại";
const WEBHOOK_ENDPOINT_PATH = "/api/import/webhook";

const BRIDGE_DETAILS: Record<BridgeProvider, { market: Market; source: string; symbol: string; externalId: string; notice: string; foreignCurrency: boolean }> = {
  vps: { market: "Chứng khoán", source: "VPS", symbol: "FPT", externalId: "vps-match-123456", foreignCurrency: false, notice: "VPS cần bridge cục bộ/đối tác hoặc watcher lịch sử. Bridge chỉ gửi lệnh đã khớp; journal không giữ mật khẩu giao dịch." },
  ssi: { market: "Chứng khoán", source: "SSI FastConnect", symbol: "SSI", externalId: "ssi-match-123456", foreignCurrency: false, notice: "FastConnect bridge giữ ConsumerSecret, PrivateKey và PIN/OTP bên ngoài journal; chỉ đẩy dữ liệu lịch sử khớp lệnh." },
  tcx: { market: "Chứng khoán", source: "TCX / TCBS", symbol: "TCB", externalId: "tcx-match-123456", foreignCurrency: false, notice: "TCX/TCBS cần bridge cục bộ/đối tác hoặc watcher statement. Journal chỉ nhận dữ liệu đã chuẩn hóa." },
  mt5: { market: "Forex", source: "MetaTrader 5", symbol: "EURUSD", externalId: "mt5-deal-123456", foreignCurrency: true, notice: "Bridge Python/EA đọc history deal từ terminal MT5 và chỉ gửi deal đã đóng; mật khẩu tài khoản MT5 không đi vào journal." },
  cqg: { market: "Hàng hóa", source: "CQG", symbol: "XAUUSD", externalId: "cqg-exec-123456", foreignCurrency: true, notice: "CQG WebAPI cần quyền truy cập do broker/FCM cấp. Bridge giữ phiên CQG và chỉ chuyển execution/post-trade sang journal." },
};

function isBridgeProvider(provider: Provider): provider is BridgeProvider {
  return BRIDGE_PROVIDERS.includes(provider as BridgeProvider);
}

function isAutoSyncConnection(connection: Connection) {
  return AUTO_SYNC_PROVIDERS.includes(connection.provider)
    && (!isBridgeProvider(connection.provider) || connection.accountType !== "push");
}

function bridgePayloadExample(provider: BridgeProvider) {
  const profile = BRIDGE_DETAILS[provider];
  return JSON.stringify({
    externalId: profile.externalId,
    symbol: profile.symbol,
    side: "BUY",
    closedAt: "2026-08-08T09:30:00Z",
    pnl: profile.foreignCurrency ? 48.5 : 1250000,
    fees: profile.foreignCurrency ? 1.2 : 45000,
    quantity: profile.foreignCurrency ? 0.2 : 500,
    entryPrice: profile.foreignCurrency ? 1.1625 : 125000,
    exitPrice: profile.foreignCurrency ? 1.1649 : 127500,
  }, null, 2);
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

const DATE = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function money(value: number, compact = false) {
  if (!compact) return MONEY.format(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}tr`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${sign}${absolute}`;
}

function dayName(date: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(new Date(`${date}T12:00:00`));
}

function marketOf(trade: Trade): Market {
  return trade.market ?? "Hàng hóa";
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(current.trim()); current = "";
    } else current += character;
  }
  values.push(current.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function parseNumeric(value: string | undefined) {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9,.-]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "")) || 0;
  }
  if ((cleaned.match(/,/g) ?? []).length > 1) return Number(cleaned.replace(/,/g, "")) || 0;
  return Number(cleaned.replace(",", ".")) || 0;
}

function parseTradeDate(value: string | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function csvToTrades(text: string, brokerName: string, market: Market): Trade[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("File CSV chưa có dữ liệu giao dịch.");
  const candidates = [",", ";", "\t"];
  const delimiter = candidates.sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  const aliases: Record<string, string[]> = {
    date: ["date", "ngay", "thoigian", "time", "ngaygiaodich", "closetime"],
    symbol: ["symbol", "ticker", "mack", "ma", "instrument", "sanpham"],
    side: ["side", "type", "mualban", "loailenh", "huong"],
    pnl: ["pnl", "profit", "lailo", "loinhuan", "realizedpnl"],
    quantity: ["quantity", "qty", "khoiluong", "volume"],
    entryPrice: ["entryprice", "openprice", "price", "gia", "giavao", "giakhop"],
    exitPrice: ["exitprice", "closeprice", "giara", "giadong"],
    fees: ["fee", "fees", "commission", "phi"],
    externalId: ["externalid", "tradeid", "orderid", "ticket", "deal", "id"],
    risk: ["risk", "plannedrisk", "ruiro", "riskamount"],
    setup: ["setup", "strategy", "chienluoc", "mohinh"],
    timeframe: ["timeframe", "tf", "khungthoigian"],
    note: ["note", "notes", "comment", "ghichu"],
    psychology: ["psychology", "tamly", "emotion"],
  };
  const indexFor = (field: string) => headers.findIndex((header) => aliases[field].includes(header));
  const positions = Object.fromEntries(Object.keys(aliases).map((field) => [field, indexFor(field)]));
  if (positions.symbol < 0) throw new Error("Không tìm thấy cột mã chứng khoán/symbol trong CSV.");
  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line, delimiter);
    const get = (field: string) => positions[field] >= 0 ? cells[positions[field]] : undefined;
    const pnl = parseNumeric(get("pnl"));
    const suppliedRisk = parseNumeric(get("risk"));
    const sideText = normalizeHeader(get("side") ?? "buy");
    const externalId = String(get("externalId") ?? "").trim();
    return {
      id: `CSV-${Date.now()}-${rowIndex}-${stableTextHash(line)}`,
      externalId: externalId || `csv-${normalizeHeader(brokerName)}-${stableTextHash(line)}`,
      date: parseTradeDate(get("date")),
      symbol: String(get("symbol") ?? "UNKNOWN").trim().toUpperCase(),
      side: sideText.includes("sell") || sideText.includes("ban") ? "Sell" : "Buy",
      session: market === "Chứng khoán" ? "Châu Á" : "New York",
      setup: String(get("setup") ?? "").trim() || UNCLASSIFIED_SETUP,
      timeframe: String(get("timeframe") ?? "").trim() || (market === "Chứng khoán" ? "Daily" : "Auto"),
      risk: suppliedRisk > 0 ? suppliedRisk : Math.max(Math.abs(pnl), 1),
      pnl,
      discipline: 0,
      psychology: String(get("psychology") ?? "").trim() || "Chưa review",
      note: [String(get("note") ?? "").trim(), `${brokerName} · nhập từ CSV`, suppliedRisk > 0 ? "" : "Rủi ro dự kiến cần review", get("setup") ? "" : "Setup cần phân loại"].filter(Boolean).join(" · "),
      durationMin: 0,
      market,
      source: `CSV · ${brokerName}`,
      quantity: parseNumeric(get("quantity")),
      entryPrice: parseNumeric(get("entryPrice")),
      stopLoss: parseNumeric(get("stopLoss")),
      takeProfit: parseNumeric(get("takeProfit")),
      exitPrice: parseNumeric(get("exitPrice")) || parseNumeric(get("entryPrice")),
      fees: Math.abs(parseNumeric(get("fees"))),
    } as Trade;
  }).filter((trade) => trade.symbol !== "UNKNOWN");
}

function makeDraft(): DraftTrade {
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()),
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
  const stockBridge = provider === "vps" || provider === "ssi" || provider === "tcx";
  return {
    provider,
    label: broker?.name ?? provider,
    accountType: isBridgeProvider(provider) ? "push" : provider === "bybit" ? "linear" : provider === "binance" ? "futures" : "default",
    apiKey: "",
    apiSecret: "",
    symbols: "BTCUSDT, ETHUSDT, SOLUSDT",
    fxRate: stockBridge ? "1" : "26000",
    bridgeUrl: "",
    bridgeToken: "",
    brokerName: "VPS",
  };
}

function calculateStats(source: Trade[]) {
  const ordered = [...source].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
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
      if ((ordered[index].pnl > 0) === positive && ordered[index].pnl !== 0) currentStreak += 1;
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
    averageR: source.length ? source.reduce((sum, t) => sum + (t.risk ? t.pnl / t.risk : 0), 0) / source.length : 0,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    expectancy: source.length ? net / source.length : 0,
    maxDrawdown,
    recovery: maxDrawdown ? net / maxDrawdown : 0,
    sharpe: deviation ? mean / deviation : 0,
    longestWin,
    longestLoss,
    currentStreak,
    avgDuration: source.length ? source.reduce((sum, t) => sum + t.durationMin, 0) / source.length : 0,
    biggestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0,
    biggestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0,
    roi: risk ? (net / risk) * 100 : 0,
    discipline: source.length ? source.reduce((sum, t) => sum + t.discipline, 0) / source.length : 0,
  };
}

function groupTrades(source: Trade[], key: "symbol" | "setup" | "session" | "weekday") {
  const map = new Map<string, { label: string; pnl: number; count: number; wins: number }>();
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

function EquityChart({ trades }: { trades: Trade[] }) {
  const points = useMemo(() => {
    const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const daily = new Map<string, number>();
    for (const trade of ordered) daily.set(trade.date, (daily.get(trade.date) ?? 0) + trade.pnl);
    const totalRisk = Math.max(ordered.reduce((sum, trade) => sum + Math.max(trade.risk, 0), 0), 1);
    let cumulative = 0;
    return [...daily].map<EquityChartPoint>(([date, pnl]) => {
      cumulative += pnl;
      return { date, money: cumulative, percent: cumulative / totalRisk * 100 };
    });
  }, [trades]);
  return (
    <EquityTimeChart
      points={points}
      ariaLabel="Đường cong lợi nhuận tích lũy theo thời gian với trục phần trăm bên trái và số tiền bên phải"
      percentLabel="ROI / tổng rủi ro (%)"
      moneyLabel="Lãi lỗ (VND)"
    />
  );
}

function MetricCard({ label, value, tone = "neutral", hint }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" | "gold"; hint: string }) {
  return (
    <article className={`metric-card ${tone}`} title={hint}>
      <span>{label}</span>
      <strong>{value}</strong>
      <i aria-hidden="true">i</i>
    </article>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><span>◇</span><strong>{title}</strong><p>{copy}</p></div>;
}

export default function Home() {
  const { data: accountSession, isPending: accountSessionPending } = authClient.useSession();
  const [siteUser, setSiteUser] = useState<{id:string}|null>();
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/site-session', {cache:'no-store',signal:controller.signal}).then(async (r) => r.ok ? (await r.json() as {user:{id:string}}).user : null).then((user) => { if(!controller.signal.aborted) setSiteUser(user); }).catch(() => { if(!controller.signal.aborted) setSiteUser(null); });
    return () => controller.abort();
  }, []);
  const accountId = accountSession?.user.id ?? siteUser?.id ?? "device";
  const WEBHOOK_ENDPOINT = typeof window === 'undefined' ? WEBHOOK_ENDPOINT_PATH : window.location.origin + WEBHOOK_ENDPOINT_PATH;
  const storageSuffix = accountId === "device" ? "" : `:${accountId}`;
  const tradesStorageKey = `tuan-trader-trades${storageSuffix}`;
  const notesStorageKey = `tuan-trader-notes${storageSuffix}`;
  const demoStorageKey = `${DEMO_STORAGE_KEY}${storageSuffix}`;
  const [view, setView] = useState<View>("overview");
  const [trades, setTrades] = useState<Trade[]>(SAMPLE_TRADES);
  const [isDemo, setIsDemo] = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("symbol");
  const [range, setRange] = useState("all");
  const [query, setQuery] = useState("");
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [journalMarket, setJournalMarket] = useState<"all" | Market>("all");
  const [marketScope, setMarketScope] = useState<"all" | Market>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [draftImages, setDraftImages] = useState<File[]>([]);
  const [tradeImages, setTradeImages] = useState<TradeImage[]>([]);
  const [imageTradeId, setImageTradeId] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [activeImage, setActiveImage] = useState<TradeImage | null>(null);
  const [connectProvider, setConnectProvider] = useState<Provider | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>(() => makeConnectionDraft("binance"));
  const [connections, setConnections] = useState<Connection[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncStatus, setAutoSyncStatus] = useState("Chọn đồng bộ ngay hoặc bật tự đồng bộ");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [localFallback, setLocalFallback] = useState(false);
  const [webhookToken, setWebhookToken] = useState("");
  const [dataMode, setDataMode] = useState<"cloud" | "device">("device");
  const [mobileNav, setMobileNav] = useState(false);
  const [draft, setDraft] = useState<DraftTrade>(makeDraft);
  const [toast, setToast] = useState("");
  const [tradeImportPreview, setTradeImportPreview] = useState<TradeImportPreview | null>(null);
  const [tradeImportBusy, setTradeImportBusy] = useState(false);
  const [notes, setNotes] = useState<string>(NOTE_TEMPLATES[0].content);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 7, 1));

  const syncAllLock = useRef(false);
  const syncAllConnectionsRef = useRef<(silent?: boolean, staleOnly?: boolean) => Promise<void>>(async () => undefined);

  const draftImagePreviews = useMemo(
    () => draftImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [draftImages],
  );

  useEffect(() => {
    return () => draftImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [draftImagePreviews]);

  useEffect(() => {
    if (accountSessionPending || siteUser === undefined) return;
    const controller = new AbortController();
    let active = true;
    const stored = window.localStorage.getItem(tradesStorageKey);
    const storedNotes = window.localStorage.getItem(notesStorageKey);
    const storedDemoMode = window.localStorage.getItem(demoStorageKey);
    const storageTimer = window.setTimeout(() => {
      setTrades(SAMPLE_TRADES);
      setIsDemo(true);
      setDataMode('device');
      setLocalFallback(false);
      setConnections([]);
      setTradeImages([]);
      setAutoSyncEnabled(false);
      if (stored) {
        try {
          const localTrades = JSON.parse(stored) as Trade[];
          if (!Array.isArray(localTrades)) throw Error('INVALID_LOCAL_TRADES');
          setTrades(localTrades);
          setIsDemo(storedDemoMode === "true" || (storedDemoMode === null && isDemoDataset(localTrades)));
        } catch { /* keep the clearly labelled demo data */ }
      }
      if (storedNotes) setNotes(storedNotes);
      void (async () => {
      try {
        const response = await fetch("/api/trades", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) return;
        if (!response.ok) return;
        const payload = await response.json() as { trades?: Trade[] };
        if (!active || controller.signal.aborted) return;
        if (!Array.isArray(payload.trades)) throw Error('Cloud response missing trades');
        setDataMode("cloud");
        const cloudTrades = payload.trades ?? [];
        if (!cloudTrades.length && stored && (JSON.parse(stored) as Trade[]).length) {
          setLocalFallback(true);
          setToast('Cloud đang trống; đã giữ nguyên nhật ký trên thiết bị.');
          return;
        }
        if (stored && stored !== JSON.stringify(cloudTrades)) {
          window.localStorage.setItem(`tuan-trader-recovery:${tradesStorageKey}:${Date.now()}`, JSON.stringify({ at:new Date().toISOString(), trades:stored, notes:storedNotes, demo:storedDemoMode }));
        }
        setLocalFallback(false);
        setTrades(cloudTrades);
        setIsDemo(false);
        window.localStorage.setItem(tradesStorageKey, JSON.stringify(cloudTrades));
        window.localStorage.setItem(demoStorageKey, "false");
      } catch { /* preview and offline mode keep device data */ }
      })();
      void loadConnections(controller.signal);
      void loadTradeImages(controller.signal);
    }, 0);
    return () => { active=false; controller.abort(); window.clearTimeout(storageTimer); };
  }, [accountSessionPending, siteUser, accountId, demoStorageKey, notesStorageKey, tradesStorageKey]);

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
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("no-scroll"); };
  }, [modalOpen, connectProvider, activeImage]);

  useEffect(() => {
    const syncViewFromUrl = () => {
      const requested = window.location.hash.slice(1) as View;
      if (requested && Object.prototype.hasOwnProperty.call(VIEW_META, requested)) setView(requested);
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
    const marketTrades = marketScope === "all" ? trades : trades.filter((trade) => marketOf(trade) === marketScope);
    if (range === "all") return marketTrades;
    const maxDate = new Date("2026-08-07T12:00:00");
    const days = Number(range);
    const cutoff = new Date(maxDate);
    cutoff.setDate(cutoff.getDate() - days);
    return marketTrades.filter((trade) => new Date(`${trade.date}T12:00:00`) >= cutoff);
  }, [range, trades, marketScope]);

  const stats = useMemo(() => calculateStats(filteredByRange), [filteredByRange]);
  const allStats = useMemo(() => calculateStats(trades), [trades]);
  const symbols = useMemo(() => [...new Set(trades.map((trade) => trade.symbol))].sort(), [trades]);
  const journalTrades = useMemo(() => trades.filter((trade) => {
    const haystack = `${trade.symbol} ${trade.setup} ${trade.note}`.toLowerCase();
    const queryMatch = haystack.includes(query.toLowerCase());
    const symbolMatch = symbolFilter === "all" || trade.symbol === symbolFilter;
    const resultMatch = resultFilter === "all" || (resultFilter === "win" ? trade.pnl > 0 : resultFilter === "loss" ? trade.pnl < 0 : trade.pnl === 0);
    const marketMatch = journalMarket === "all" || marketOf(trade) === journalMarket;
    return queryMatch && symbolMatch && resultMatch && marketMatch;
  }).sort((a, b) => b.date.localeCompare(a.date)), [trades, query, symbolFilter, resultFilter, journalMarket]);

  const tradesById = useMemo(() => new Map(trades.map((trade) => [trade.id, trade])), [trades]);
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
    () => tradeImages.filter((image) => tradesById.has(image.tradeId)).slice(0, 6),
    [tradeImages, tradesById],
  );
  const activeImageTrade = activeImage ? tradesById.get(activeImage.tradeId) : undefined;
  const activeImageSiblings = activeImage ? imagesByTrade.get(activeImage.tradeId) ?? [] : [];
  const latestTradeId = useMemo(
    () => [...trades].sort((a, b) => b.date.localeCompare(a.date))[0]?.id ?? "",
    [trades],
  );
  const effectiveImageTradeId = imageTradeId && tradesById.has(imageTradeId) ? imageTradeId : latestTradeId;

  async function loadConnections(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/connections", { cache: "no-store", signal });
      if (!response.ok) return;
      const payload = await response.json() as { connections?: Connection[] };
      if(signal?.aborted) return;
      setConnections(payload.connections ?? []);
    } catch { /* connections stay empty in device-only preview */ }
  }

  async function loadTradeImages(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/trade-images", { cache: "no-store", signal });
      if (!response.ok) return;
      const payload = await response.json() as { images?: TradeImage[] };
      if(signal?.aborted) return;
      setTradeImages(payload.images ?? []);
    } catch { /* image gallery remains available after cloud reconnect */ }
  }

  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    if (window.location.hash !== `#${next}`) window.history.pushState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openTradeModal = () => {
    setEditingTradeId(null);
    setDraft(makeDraft());
    setDraftImages([]);
    setModalOpen(true);
  };

  const openEditTradeModal = (trade: Trade) => {
    if (isDemo) {
      setToast("Hãy bắt đầu nhật ký thật trước khi chỉnh sửa giao dịch.");
      return;
    }
    setEditingTradeId(trade.id);
    setDraft(makeDraftFromTrade(trade));
    setDraftImages([]);
    setModalOpen(true);
  };

  const selectDraftImages = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    const valid = picked.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 6 * 1024 * 1024);
    if (valid.length !== picked.length) setToast("Chỉ nhận JPG, PNG, WEBP tối đa 6 MB/ảnh.");
    setDraftImages((current) => [...current, ...valid].slice(0, 4));
    if (valid.length) setDraft((current) => ({ ...current, screenshot: true }));
  };

  const uploadTradeImages = async (tradeId: string, files: File[]) => {
    const uploaded: TradeImage[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set("tradeId", tradeId);
      formData.set("file", file);
      const response = await fetch("/api/trade-images", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({})) as { image?: TradeImage; error?: string };
      if (!response.ok || !payload.image) throw new Error(payload.error ?? "Không thể lưu hình ảnh");
      uploaded.push(payload.image);
    }
    if (uploaded.length) setTradeImages((current) => [...uploaded.reverse(), ...current]);
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
      setToast("Lưu ảnh riêng tư lên cloud hiện không khả dụng; giao dịch và ghi chú vẫn được lưu trên thiết bị này.");
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
      setToast(error instanceof Error ? error.message : "Không thể tải hình ảnh.");
    } finally {
      setImageUploading(false);
    }
  };

  const deleteTradeImage = async (image: TradeImage) => {
    if (!window.confirm("Xóa hình ảnh này khỏi nhật ký?")) return;
    try {
      const response = await fetch(`/api/trade-images?id=${encodeURIComponent(image.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Không thể xóa hình ảnh");
      setTradeImages((current) => current.filter((item) => item.id !== image.id));
      setActiveImage(null);
      setToast("Đã xóa hình ảnh.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể xóa hình ảnh.");
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
  const prepareTradeImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setTradeImportPreview(null);
    setTradeImportBusy(true);
    try {
      const extension = file.name.toLowerCase().split(".").pop();
      const isPdf = extension === "pdf" || file.type === "application/pdf";
      let result: { trades: Trade[]; errors: string[]; detected: number };
      if (isPdf) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        let text = "";
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          text += `${content.items.map((item) => "str" in item ? item.str : "").join(" ")}\n`;
        }
        const parsed = parseBinanceFuturesText(text);
        result = { ...parsed, trades: parsed.trades.map(binanceToTrade) };
      } else if (extension === "csv") {
        result = parseTradeCsv(await file.text(), "CSV");
      } else if (["xlsx", "xls", "xlsm"].includes(extension ?? "")) {
        result = await parseTradeWorkbook(file);
      } else {
        throw new Error("Định dạng chưa hỗ trợ. Hãy chọn PDF Binance Futures, Excel hoặc CSV.");
      }
      if (!result.detected && !result.trades.length) throw new Error(result.errors[0] ?? "Không tìm thấy giao dịch trong file.");
      setTradeImportPreview({ fileName: file.name, detected: result.detected, trades: result.trades, errors: result.errors });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không đọc được file nhật ký.");
    } finally {
      setTradeImportBusy(false);
    }
  };
  const commitTradeImport = async () => {
    if (!tradeImportPreview?.trades.length) return;
    setTradeImportBusy(true);
    try {
      const imported = tradeImportPreview.trades;
      let accepted: Trade[] = [];
      if (dataMode === "cloud") {
        for (let index = 0; index < imported.length; index += 500) {
          const response = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trades: imported.slice(index, index + 500) }) });
          const payload = await response.json().catch(() => ({})) as { trades?: Trade[]; error?: string };
          if (!response.ok) throw new Error(payload.error ?? "Database unavailable");
          accepted = [...accepted, ...(payload.trades ?? [])];
        }
      } else {
        const known = new Set(trades.filter((trade) => !isDemoDataset(trades)).map((trade) => trade.externalId ?? trade.id));
        accepted = imported.filter((trade) => {
          const key = trade.externalId ?? trade.id;
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
      }
      setTrades((current) => {
        const base = isDemoDataset(current) ? [] : current;
        const known = new Set(base.map((trade) => trade.externalId ?? trade.id));
        const unique = accepted.filter((trade) => {
          const key = trade.externalId ?? trade.id;
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        const next = [...unique, ...base];
        window.localStorage.setItem(tradesStorageKey, JSON.stringify(next));
        return next;
      });
      setIsDemo(false);
      window.localStorage.setItem(demoStorageKey, "false");
      setTradeImportPreview(null);
      setToast(`Đã thêm ${accepted.length}/${imported.length} giao dịch · Trùng: ${imported.length - accepted.length} · Dòng lỗi: ${tradeImportPreview.errors.length}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể lưu giao dịch đã nhập.");
    } finally {
      setTradeImportBusy(false);
    }
  };
  const saveTrade = async (event: FormEvent) => {
    event.preventDefault();
    const risk = Number(draft.risk);
    const pnl = Number(draft.pnl);
    if (!draft.date || !draft.symbol.trim() || draft.setup === UNCLASSIFIED_SETUP || !Number.isFinite(risk) || risk <= 0 || !Number.isFinite(pnl)) {
      setToast("Vui lòng nhập ngày, sản phẩm, setup, rủi ro và P&L trước phí.");
      return;
    }
    const checks = [draft.plan, draft.noFomo, draft.noRevenge, draft.screenshot];
    const existing = editingTradeId ? trades.find((item) => item.id === editingTradeId) : undefined;
    const trade: Trade = {
      id: existing?.id ?? `T${Date.now()}`,
      date: draft.date,
      symbol: draft.symbol.trim().toUpperCase(),
      side: draft.side,
      session: draft.session,
      setup: draft.setup,
      timeframe: draft.timeframe,
      risk,
      pnl,
      discipline: Math.round((checks.filter(Boolean).length / checks.length) * 100),
      psychology: draft.psychology,
      note: draft.note,
      durationMin: Number(draft.durationMin) || 0,
      market: draft.market,
      source: draft.source,
      fees: Number(draft.fees) || 0,
      quantity: Number(draft.quantity) || 0,
      entryPrice: Number(draft.entryPrice) || 0,
      stopLoss: Number(draft.stopLoss) || 0,
      takeProfit: Number(draft.takeProfit) || 0,
      exitPrice: Number(draft.exitPrice) || 0,
      externalId: existing?.externalId,
      accountId: existing?.accountId,
    };
    const imagesToUpload = [...draftImages];
    const next = existing
      ? trades.map((item) => item.id === trade.id ? trade : item)
      : isDemo ? [trade] : [...trades, trade];
    setTrades(next);
    setIsDemo(false);
    window.localStorage.setItem(tradesStorageKey, JSON.stringify(next));
    window.localStorage.setItem(demoStorageKey, "false");
    setModalOpen(false);
    setEditingTradeId(null);
    setDraftImages([]);
    setImageTradeId(trade.id);
    if (dataMode === "cloud") {
      try {
        const response = await fetch("/api/trades", { method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trade }) });
        if (!response.ok) throw new Error("Không thể đồng bộ giao dịch");
        const imageCount = imagesToUpload.length ? await uploadTradeImages(trade.id, imagesToUpload) : 0;
        setToast(imageCount ? `Đã lưu giao dịch và ${imageCount} hình ảnh.` : existing ? "Đã cập nhật giao dịch." : "Đã lưu giao dịch mới.");
      } catch { setToast("Đã lưu trên thiết bị; dữ liệu cloud hoặc hình ảnh chưa đồng bộ."); }
    } else {
      setToast(imagesToUpload.length ? "Đã lưu lệnh trên thiết bị; ảnh chưa được đồng bộ." : existing ? "Đã cập nhật giao dịch." : "Đã lưu giao dịch mới.");
    }
  };

  const deleteTrade = async (id: string) => {
    const trade = trades.find((item) => item.id === id);
    if (!window.confirm(`Xóa giao dịch ${trade?.symbol ?? "này"}? Hành động này không thể hoàn tác.`)) return;
    const next = trades.filter((trade) => trade.id !== id);
    setTrades(next);
    setTradeImages((current) => current.filter((image) => image.tradeId !== id));
    window.localStorage.setItem(tradesStorageKey, JSON.stringify(next));
    setToast("Đã xóa giao dịch.");
    if (dataMode === "cloud") {
      try { await fetch(`/api/trades?id=${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* optimistic device deletion */ }
    }
  };

  const restoreDemo = async () => {
    setTrades(SAMPLE_TRADES);
    setIsDemo(true);
    window.localStorage.setItem(tradesStorageKey, JSON.stringify(SAMPLE_TRADES));
    window.localStorage.setItem(demoStorageKey, "true");
    setToast("Đang hiển thị dữ liệu minh họa; dữ liệu cloud không bị thay đổi.");
  };

  const startRealJournal = () => {
    setTrades([]);
    setTradeImages([]);
    setIsDemo(false);
    window.localStorage.setItem(tradesStorageKey, "[]");
    window.localStorage.setItem(demoStorageKey, "false");
    setToast("Đã chuyển sang nhật ký của bạn. Hãy thêm giao dịch đầu tiên.");
    navigate("journal");
  };

  const clearAll = async () => {
    if (isDemo) {
      startRealJournal();
      return;
    }
    if (!window.confirm("Xóa toàn bộ giao dịch? Hãy xuất bản sao trước nếu bạn cần khôi phục.")) return;
    setTrades([]);
    setTradeImages([]);
    setIsDemo(false);
    window.localStorage.setItem(tradesStorageKey, "[]");
    window.localStorage.setItem(demoStorageKey, "false");
    setToast("Đã xóa toàn bộ dữ liệu.");
    if (dataMode === "cloud") {
      try { await fetch("/api/trades?all=1", { method: "DELETE" }); } catch { setToast("Đã xóa trên thiết bị; cloud chưa phản hồi."); }
    }
  };

  const saveNotes = () => {
    window.localStorage.setItem(notesStorageKey, notes);
    setToast("Đã lưu ghi chú.");
  };

  const insertNoteTemplate = (template: (typeof NOTE_TEMPLATES)[number]) => {
    setNotes((current) => current.trim()
      ? `${current.trim()}\n\n────────────────────\n\n${template.content}`
      : template.content);
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
    const payload = JSON.stringify({
      format: "trading-plan-pro-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      trades,
      notes,
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trading-plan-pro-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Đã tạo bản sao JSON; không bao gồm khóa broker.");
  };

  const exportTradeHistory = async () => {
    if (!journalTrades.length) {
      setToast("Không có giao dịch phù hợp để xuất Excel.");
      return;
    }
    try {
      const { downloadTradeWorkbook } = await import("../../lib/trade-excel");
      downloadTradeWorkbook(journalTrades);
      setToast(`Đã xuất ${journalTrades.length} giao dịch ra Excel.`);
    } catch {
      setToast("Chưa thể tạo tệp Excel. Vui lòng thử lại.");
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { trades?: Trade[]; notes?: string } | Trade[];
      const incoming = Array.isArray(parsed) ? parsed : parsed.trades;
      if (!Array.isArray(incoming) || !incoming.length) throw new Error("Bản sao không có giao dịch hợp lệ.");
      const invalid = incoming.some((trade) => !trade?.id || !trade?.date || !trade?.symbol || !Number.isFinite(Number(trade.pnl)));
      if (invalid) throw new Error("Bản sao có dòng dữ liệu không đúng định dạng.");
      const base = isDemo ? [] : trades;
      const merged = new Map(base.map((trade) => [trade.id, trade]));
      incoming.forEach((trade) => merged.set(trade.id, trade));
      const next = [...merged.values()];
      setTrades(next);
      setIsDemo(false);
      if (!Array.isArray(parsed) && typeof parsed.notes === "string") setNotes(parsed.notes);
      window.localStorage.setItem(tradesStorageKey, JSON.stringify(next));
      window.localStorage.setItem(demoStorageKey, "false");
      if (dataMode === "cloud") {
        await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trades: incoming }) });
      }
      setToast(`Đã nhập ${incoming.length} giao dịch từ bản sao.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể đọc bản sao.");
    } finally {
      event.target.value = "";
    }
  };

  const openConnection = (provider: Provider) => {
    if (dataMode !== "cloud") {
      setToast("Kết nối broker tự động cần kho cloud riêng. Bạn có thể nhập PDF, Excel hoặc CSV trực tiếp trong Nhật ký.");
      return;
    }
    setWebhookToken("");
    const existing = connections.find((connection) => connection.provider === provider);
    const nextDraft = makeConnectionDraft(provider);
    if (existing) {
      nextDraft.label = existing.label;
      nextDraft.accountType = isBridgeProvider(provider) && !["push", "pull"].includes(existing.accountType)
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
          symbols: connectionDraft.symbols.split(",").map((symbol) => symbol.trim()).filter(Boolean),
          fxRate: Number(connectionDraft.fxRate),
        }),
      });
      const payload = await response.json() as { error?: string; webhookToken?: string };
      if (!response.ok) throw new Error(payload.error ?? "Không thể lưu kết nối");
      await loadConnections();
      setDataMode("cloud");
      const tokenConnection = connectProvider === "webhook"
        || (isBridgeProvider(connectProvider) && connectionDraft.accountType === "push");
      if (tokenConnection) {
        if (!payload.webhookToken) throw new Error("Máy chủ chưa trả về token bảo mật.");
        setWebhookToken(payload.webhookToken);
        setToast(`Đã tạo khóa ${BROKERS.find((broker) => broker.provider === connectProvider)?.name ?? "bridge"}. Token chỉ hiển thị lần này.`);
      } else {
        setConnectProvider(null);
        setToast("Đã lưu kết nối an toàn. Khóa bridge/API được mã hóa.");
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể lưu kết nối.");
    }
  };

  const mergeSyncedTrades = (incoming: Trade[]) => {
    if (!incoming.length) return;
    setTrades((current) => {
      const base = isDemoDataset(current) ? [] : current;
      const merged = new Map(base.map((trade) => [`${trade.source ?? ""}:${trade.externalId ?? trade.id}`, trade]));
      for (const trade of incoming) {
        const key = `${trade.source ?? ""}:${trade.externalId ?? trade.id}`;
        if (!merged.has(key)) merged.set(key, trade);
      }
      const next = [...merged.values()];
      window.localStorage.setItem(tradesStorageKey, JSON.stringify(next));
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
    const payload = await response.json() as { error?: string; imported?: number; trades?: Trade[] };
    if (!response.ok) throw new Error(payload.error ?? "Đồng bộ thất bại");
    mergeSyncedTrades(payload.trades ?? []);
    return payload.imported ?? 0;
  };

  const syncConnection = async (connection: Connection) => {
    setSyncingId(connection.id);
    try {
      const imported = await performConnectionSync(connection);
      await loadConnections();
      setAutoSyncStatus(`Đồng bộ gần nhất lúc ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`);
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
      ? eligible.filter((connection) => !connection.lastSyncAt || Date.now() - new Date(connection.lastSyncAt).getTime() >= 15 * 60 * 1000)
      : eligible;
    if (!targets.length) {
      if (eligible.length) setAutoSyncStatus("Dữ liệu đã được kiểm tra trong 15 phút gần nhất");
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
          errors.push(`${connection.label}: ${error instanceof Error ? error.message : "lỗi đồng bộ"}`);
        }
      }
      await loadConnections();
      const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      setAutoSyncStatus(errors.length ? `Hoàn tất ${time} · ${errors.length} kết nối cần kiểm tra` : `Hoàn tất ${time} · ${imported} lệnh mới`);
      if (!silent) setToast(errors.length ? errors[0] : `Đã đồng bộ tất cả, thêm ${imported} giao dịch.`);
    } finally {
      setAutoSyncing(false);
      syncAllLock.current = false;
    }
  };

  const disconnect = async (connection: Connection) => {
    if (!window.confirm(`Ngắt kết nối ${connection.label}? Dữ liệu giao dịch đã nhập vẫn được giữ lại.`)) return;
    try {
      const response = await fetch(`/api/connections?id=${encodeURIComponent(connection.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Không thể ngắt kết nối");
      await loadConnections();
      setToast("Đã ngắt kết nối broker.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Không thể ngắt kết nối."); }
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    const brokerName = event.target.dataset.broker ?? "Nguồn dữ liệu";
    const market = (event.target.dataset.market ?? "Chứng khoán") as Market;
    try {
      const importedTrades = (await Promise.all(files.map(async (file) => csvToTrades(await file.text(), brokerName, market)))).flat();
      if (!importedTrades.length) throw new Error("Không có dòng giao dịch hợp lệ.");
      let accepted = importedTrades;
      if (dataMode === "cloud") {
        accepted = [];
        for (let index = 0; index < importedTrades.length; index += 1500) {
          const response = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trades: importedTrades.slice(index, index + 1500) }) });
          const payload = await response.json() as { error?: string; trades?: Trade[] };
          if (!response.ok) throw new Error(payload.error ?? "Không thể nhập dữ liệu");
          accepted.push(...(payload.trades ?? []));
        }
      }
      setTrades((current) => {
        const base = isDemoDataset(current) ? [] : current;
        const known = new Set(base.map((trade) => `${trade.source ?? ""}:${trade.externalId ?? trade.id}`));
        const unique = accepted.filter((trade) => {
          const key = `${trade.source ?? ""}:${trade.externalId ?? trade.id}`;
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        const next = [...unique, ...base];
        window.localStorage.setItem(tradesStorageKey, JSON.stringify(next));
        return next;
      });
      setIsDemo(false);
      window.localStorage.setItem(demoStorageKey, "false");
      setToast(`Đã nhập ${accepted.length} giao dịch mới từ ${files.length} file ${brokerName}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể đọc file CSV.");
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    syncAllConnectionsRef.current = syncAllConnections;
  });

  useEffect(() => {
    if (!autoSyncEnabled || dataMode !== "cloud" || !connections.some(isAutoSyncConnection)) return;
    const initial = window.setTimeout(() => { void syncAllConnectionsRef.current(true, true); }, 800);
    const interval = window.setInterval(() => { void syncAllConnectionsRef.current(true); }, 15 * 60 * 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [autoSyncEnabled, dataMode, connections]);

  const renderOverview = () => {
    const tone = (value: number): "positive" | "negative" | "neutral" => value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
    const metricCards = [
      ["Tổng số lệnh", String(stats.total), "neutral", "Số lệnh trong khoảng thời gian đang lọc."],
      ["Tỷ lệ thắng", `${stats.winRate.toFixed(1)}%`, stats.winRate >= 50 ? "positive" : "negative", "Số lệnh thắng chia cho tổng số lệnh."],
      ["Hệ số lợi nhuận", stats.profitFactor.toFixed(2), stats.profitFactor >= 1.5 ? "positive" : "gold", "Tổng lãi chia tổng lỗ; trên 1 là có lãi ròng."],
      ["Kỳ vọng theo R", `${stats.averageR.toFixed(2)}R`, tone(stats.averageR), "R trung bình thực nhận trên mỗi giao dịch, gồm cả lệnh thắng và lệnh thua."],
      ["Lãi TB/lệnh thắng", money(stats.avgWin, true), "positive", "Tiền lãi trung bình của mỗi lệnh thắng."],
      ["Lỗ TB/lệnh thua", money(-stats.avgLoss, true), "negative", "Tiền lỗ trung bình của mỗi lệnh thua."],
      ["Kỳ vọng lợi nhuận", money(stats.expectancy, true), tone(stats.expectancy), "Kết quả trung bình kỳ vọng cho mỗi lệnh."],
      ["Lợi nhuận ròng", money(stats.net, true), tone(stats.net), "Tổng lãi trừ tổng lỗ."],
      ["Lệnh thắng", String(stats.wins), "positive", "Số giao dịch có lãi."],
      ["Lệnh thua", String(stats.losses), "negative", "Số giao dịch thua lỗ."],
      ["Hòa vốn", String(stats.breakeven), "neutral", "Số giao dịch không lãi không lỗ."],
      ["Chuỗi hiện tại", stats.currentStreak > 0 ? `W${stats.currentStreak}` : stats.currentStreak < 0 ? `L${Math.abs(stats.currentStreak)}` : "0", tone(stats.currentStreak), "Chuỗi thắng hoặc thua gần nhất."],
      ["Chuỗi thắng dài nhất", String(stats.longestWin), "positive", "Chuỗi lệnh thắng dài nhất."],
      ["Chuỗi thua dài nhất", String(stats.longestLoss), "negative", "Chuỗi lệnh thua dài nhất."],
      ["Sụt giảm tối đa", money(-stats.maxDrawdown, true), "negative", "Mức giảm lớn nhất từ đỉnh vốn xuống đáy."],
      ["Hệ số phục hồi", stats.recovery.toFixed(2), tone(stats.recovery), "Lợi nhuận ròng chia cho sụt giảm tối đa."],
      ["Chỉ số ổn định", stats.sharpe.toFixed(2), tone(stats.sharpe), "Lợi nhuận trung bình so với độ biến động kết quả."],
      ["Thời gian giữ lệnh TB", `${Math.round(stats.avgDuration)}m`, "neutral", "Thời gian giữ lệnh trung bình."],
      ["Lệnh thắng lớn nhất", money(stats.biggestWin, true), "positive", "Lợi nhuận lớn nhất trong một giao dịch."],
      ["Lệnh thua lớn nhất", money(stats.biggestLoss, true), "negative", "Thua lỗ lớn nhất trong một giao dịch."],
      ["Tổng lãi", money(stats.grossProfit, true), "positive", "Tổng tiền lãi trước khi trừ lỗ."],
      ["Tổng lỗ", money(-stats.grossLoss, true), "negative", "Tổng tiền lỗ trước khi cộng lãi."],
      ["ROI / Tổng rủi ro", `${stats.roi.toFixed(1)}%`, tone(stats.roi), "Lợi nhuận ròng chia cho tổng vốn đã mạo hiểm."],
      ["Kỷ luật trung bình", `${stats.discipline.toFixed(0)}%`, stats.discipline >= 85 ? "positive" : "gold", "Tỷ lệ tuân thủ checklist trên tất cả giao dịch."],
    ] as const;
    const winDeg = stats.total ? (stats.wins / stats.total) * 360 : 0;
    const lossDeg = stats.total ? (stats.losses / stats.total) * 360 : 0;
    const donutStyle = { "--win": `${winDeg}deg`, "--loss": `${winDeg + lossDeg}deg` } as CSSProperties;
    const daily = groupTrades(filteredByRange, "weekday");
    const maxDaily = Math.max(...daily.map((item) => Math.abs(item.pnl)), 1);
    const marketRollup = MARKETS.slice(1).map((market) => {
      const marketTrades = trades.filter((trade) => marketOf(trade) === market.id);
      return { ...market, stats: calculateStats(marketTrades) };
    });
    return (
      <>
        <section className="overview-hero">
          <div className="overview-hero-copy">
            <span className="product-kicker"><Sparkles size={14} /> TRADING PLAN PRO</span>
            <h2>Biến mỗi giao dịch thành dữ liệu để ra quyết định tốt hơn</h2>
            <p>Nhật ký đa thị trường dành cho nhà đầu tư Việt Nam: ghi lại bối cảnh, đo kỷ luật, kiểm soát rủi ro và chỉ kết luận lợi thế khi mẫu dữ liệu đủ lớn.</p>
            <div className="overview-actions">
              <button className="gold-button compact" onClick={openTradeModal}><Plus size={16} /> Ghi giao dịch</button>
              <a className="ghost-link" href="/phuong-phap">Xem phương pháp tính</a>
            </div>
          </div>
          <div className="overview-principles" aria-label="Ba nguyên tắc của Trading Plan Pro">
            <article><span>01</span><strong>Ghi đúng kế hoạch</strong><small>Kết quả không thay thế kỷ luật.</small></article>
            <article><span>02</span><strong>Đủ mẫu mới kết luận</strong><small>Tối thiểu 20 lệnh mỗi nhóm.</small></article>
            <article><span>03</span><strong>Bảo vệ vốn trước</strong><small>Rủi ro luôn có giới hạn rõ ràng.</small></article>
          </div>
        </section>
        <div className="market-switcher" role="group" aria-label="Lọc theo thị trường">
          {MARKETS.map((market) => <button key={market.id} className={marketScope === market.id ? "active" : ""} onClick={() => setMarketScope(market.id)}><span>{market.icon}</span>{market.label}</button>)}
        </div>
        <div className="market-overview-grid">
          {marketRollup.map((market) => <article key={market.id}><div><span>{market.icon}</span><div><small>{market.label}</small><strong>{market.stats.total} lệnh</strong></div></div><b className={market.stats.net >= 0 ? "positive-text" : "negative-text"}>{money(market.stats.net, true)}</b></article>)}
        </div>
        <div className="metric-grid">
          {metricCards.map(([label, value, toneValue, hint]) => <MetricCard key={label} label={label} value={value} tone={toneValue} hint={hint} />)}
        </div>
        <div className="dashboard-grid">
          <article className="panel panel-wide">
            <div className="panel-title"><div><span className="eyebrow">HIỆU SUẤT TÍCH LŨY</span><h3>Đường cong vốn</h3></div><span className="status-chip">POC</span></div>
            <EquityChart trades={filteredByRange} />
          </article>
          <article className="panel donut-panel">
            <div className="panel-title"><div><span className="eyebrow">PHÂN BỔ KẾT QUẢ</span><h3>Thắng / Thua</h3></div></div>
            <div className="donut" style={donutStyle}><div><strong>{stats.winRate.toFixed(1)}%</strong><span>Tỷ lệ thắng</span></div></div>
            <div className="legend"><span className="win">Thắng {stats.wins}</span><span className="loss">Thua {stats.losses}</span><span className="be">Hòa {stats.breakeven}</span></div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">THEO NGÀY</span><h3>Lãi / Lỗ trong tuần</h3></div></div>
            <div className="bar-chart">
              {daily.map((item) => <div className="bar-column" key={item.label}><div className="bar-value">{money(item.pnl, true)}</div><div className={`bar ${item.pnl >= 0 ? "up" : "down"}`} style={{ height: `${22 + Math.abs(item.pnl) / maxDaily * 90}px` }} /><span>{item.label.replace("Thứ ", "T")}</span></div>)}
            </div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">QUẢN TRỊ VỐN</span><h3>Kỷ luật rủi ro</h3></div><strong className="positive-text">{stats.discipline.toFixed(0)}%</strong></div>
            <div className="discipline-ring" style={{ "--score": `${stats.discipline * 3.6}deg` } as CSSProperties}><div><strong>{stats.discipline.toFixed(0)}</strong><span>/ 100</span></div></div>
            <p className="panel-copy">{stats.discipline >= 90 ? "Bạn đang giữ kỷ luật rất tốt. Hãy tiếp tục ưu tiên chất lượng setup hơn số lượng lệnh." : "Kỷ luật đang giảm. Hãy dừng sau 2 lệnh thua và review checklist trước lệnh mới."}</p>
          </article>
        </div>
      </>
    );
  };

  const renderJournal = () => (
    <>
      <section className="quote-strip">
        <div><span>NGUYÊN TẮC CỐT LÕI</span><strong>“Giao dịch tốt không phải lệnh thắng — mà là lệnh đúng kế hoạch.”</strong></div>
        <div className="quote-actions">
          <button type="button" className="ghost-button excel-button" onClick={exportTradeHistory} disabled={!journalTrades.length} title={`Xuất báo cáo chi tiết cho ${journalTrades.length} giao dịch đang hiển thị`}><FileSpreadsheet size={16} /> Xuất báo cáo Excel</button><label className="gold-button compact file-button" title="Nhập giao dịch từ PDF Binance Futures, Excel hoặc CSV"><FileUp size={16} /> {tradeImportBusy ? "Đang đọc…" : "Nhập file nhật ký"}<input type="file" accept="application/pdf,.pdf,.xlsx,.xls,.xlsm,.csv,text/csv" onChange={(event) => { void prepareTradeImport(event); }} disabled={tradeImportBusy} /></label>
          <button type="button" className="gold-button compact" onClick={openTradeModal}><Plus size={17} /> Thêm giao dịch</button>
        </div>
      </section>
      <p className="journal-import-hint">PDF: lịch sử vị thế Binance Futures. Excel/CSV: cột Ngày, Sản phẩm hoặc Symbol, Lệnh, Lãi/Lỗ hoặc P&amp;L. Dữ liệu được đọc ngay trên trình duyệt và xem trước trước khi lưu.</p>
      <section className="journal-media-panel" aria-labelledby="journal-media-title">
        <div className="journal-media-head">
          <div className="journal-media-title">
            <span className="journal-media-icon"><Images size={19} /></span>
            <div><span className="eyebrow">HÌNH ẢNH GIAO DỊCH</span><h2 id="journal-media-title">Cập nhật biểu đồ vào từng lệnh</h2><p>Chọn lệnh, tải ảnh từ điện thoại và xem lại ngay trong nhật ký.</p></div>
          </div>
          <div className="journal-media-actions">
            <label><span>Gắn vào lệnh</span><select value={effectiveImageTradeId} onChange={(event) => setImageTradeId(event.target.value)} disabled={isDemo || !trades.length} aria-label="Chọn giao dịch để gắn ảnh"><option value="">Chọn giao dịch</option>{[...trades].sort((a, b) => b.date.localeCompare(a.date)).map((trade) => <option value={trade.id} key={trade.id}>{trade.date} · {trade.symbol} · {trade.side}</option>)}</select></label>
            <label className={`journal-image-upload ${isDemo || !trades.length ? "disabled" : ""}`} aria-disabled={isDemo || !trades.length}><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={isDemo || !trades.length || imageUploading} onChange={quickUploadImages} />{imageUploading ? <LoaderCircle className="spin" size={16} /> : <ImagePlus size={16} />}<span>{imageUploading ? "Đang tải..." : "Tải ảnh nhanh"}</span></label>
          </div>
        </div>
        {recentTradeImages.length ? <div className="journal-media-grid">{recentTradeImages.map((image) => {
          const trade = tradesById.get(image.tradeId);
          if (!trade) return null;
          return <button type="button" className="journal-image-card" key={image.id} onClick={() => setActiveImage(image)} aria-label={`Xem ảnh giao dịch ${trade.symbol}`}><img src={image.url} alt={`Biểu đồ ${trade.symbol} ngày ${trade.date}`} loading="lazy" /><span className="journal-image-shade"><b>{trade.symbol}</b><small>{DATE.format(new Date(`${trade.date}T12:00:00`))} · {trade.side}</small></span><i><ZoomIn size={14} /></i></button>;
        })}</div> : <div className="journal-media-empty"><Camera size={24} /><div><strong>{isDemo ? "Ảnh chỉ lưu trong nhật ký thật" : "Chưa có ảnh biểu đồ"}</strong><p>{isDemo ? "Bắt đầu nhật ký thật rồi tải ảnh trước/sau lệnh từ điện thoại." : "Dùng nút “Tải ảnh nhanh” hoặc đính kèm khi thêm giao dịch."}</p></div></div>}
      </section>
      {tradeImportPreview && <section className="panel binance-preview-panel" aria-live="polite"><div className="panel-title"><div><span className="eyebrow">XEM TRƯỚC GIAO DỊCH</span><h3>{tradeImportPreview.fileName}</h3></div><span className="status-chip">{tradeImportPreview.detected} dòng nhận diện</span></div><p className="import-summary"><strong>{tradeImportPreview.trades.length} giao dịch hợp lệ</strong> · {tradeImportPreview.errors.length} dòng cần kiểm tra · Chỉ lưu sau khi bạn xác nhận.</p><div className="table-scroll"><table><thead><tr><th>Ngày</th><th>Thị trường</th><th>Sản phẩm</th><th>Hướng</th><th>Khối lượng</th><th>Giá vào</th><th>Giá ra</th><th>Lãi/Lỗ</th></tr></thead><tbody>{tradeImportPreview.trades.slice(0, 20).map((trade) => <tr key={`${trade.id}-${trade.date}`}><td>{trade.date}</td><td>{marketOf(trade)}</td><td><strong>{trade.symbol}</strong></td><td>{trade.side}</td><td>{trade.quantity ?? 0}</td><td>{trade.entryPrice ?? 0}</td><td>{trade.exitPrice ?? 0}</td><td className={trade.pnl >= 0 ? "positive-text" : "negative-text"}>{money(trade.pnl, true)}</td></tr>)}</tbody></table></div>{tradeImportPreview.trades.length > 20 && <p className="import-summary">Hiển thị 20 dòng đầu; sẽ lưu {tradeImportPreview.trades.length} giao dịch hợp lệ.</p>}{tradeImportPreview.errors.length > 0 && <p className="import-errors">{tradeImportPreview.errors.slice(0, 3).join(" · ")}</p>}<div className="preview-actions"><button type="button" className="ghost-button" onClick={() => setTradeImportPreview(null)} disabled={tradeImportBusy}>Hủy</button><button type="button" className="gold-button compact" onClick={() => void commitTradeImport()} disabled={tradeImportBusy || !tradeImportPreview.trades.length}>{tradeImportBusy ? "Đang lưu…" : `Thêm ${tradeImportPreview.trades.length} giao dịch`}</button></div></section>}
      <section className="filter-bar">
        <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm sản phẩm, setup, ghi chú..." /></label>
        <select value={journalMarket} onChange={(e) => setJournalMarket(e.target.value as "all" | Market)} aria-label="Lọc theo thị trường"><option value="all">Tất cả thị trường</option>{MARKETS.slice(1).map((market) => <option key={market.id} value={market.id}>{market.label}</option>)}</select>
        <select value={symbolFilter} onChange={(e) => setSymbolFilter(e.target.value)} aria-label="Lọc theo sản phẩm"><option value="all">Tất cả sản phẩm</option>{symbols.map((symbol) => <option key={symbol}>{symbol}</option>)}</select>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} aria-label="Lọc theo kết quả"><option value="all">Mọi kết quả</option><option value="win">Thắng</option><option value="loss">Thua</option><option value="be">Hòa vốn</option></select>
        <button className="ghost-button" onClick={() => { setQuery(""); setSymbolFilter("all"); setResultFilter("all"); setJournalMarket("all"); }}>Xóa lọc</button>
      </section>
      <section className="table-panel journal-results" aria-live="polite">
        {journalTrades.length ? <><div className="journal-table-desktop"><div className="table-scroll" tabIndex={0} aria-label="Bảng lịch sử giao dịch, có thể cuộn ngang"><table><thead><tr><th>Ngày</th><th>Thị trường</th><th>Sản phẩm</th><th>Nguồn</th><th>Hướng</th><th>Phiên</th><th>Setup</th><th>TF</th><th>Rủi ro</th><th>RR</th><th>Kết quả</th><th>Lãi / Lỗ</th><th>Kỷ luật</th><th>Ảnh</th><th /></tr></thead><tbody>
          {journalTrades.map((trade) => { const images = imagesByTrade.get(trade.id) ?? []; return <tr key={trade.id}><td>{DATE.format(new Date(`${trade.date}T12:00:00`))}</td><td><span className={`market-badge market-${marketOf(trade).toLowerCase().replace(" ", "-")}`}>{marketOf(trade)}</span></td><td><strong>{trade.symbol}</strong></td><td><span className="source-badge">{trade.source ?? "Thủ công"}</span></td><td><span className={`side ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td>{trade.session}</td><td>{trade.setup}</td><td>{trade.timeframe}</td><td>{money(trade.risk, true)}</td><td>{trade.risk ? (trade.pnl / trade.risk).toFixed(2) : "0.00"}R</td><td><span className={`result ${trade.pnl > 0 ? "win" : trade.pnl < 0 ? "loss" : "be"}`}>{trade.pnl > 0 ? "Thắng" : trade.pnl < 0 ? "Thua" : "Hòa"}</span></td><td className={trade.pnl >= 0 ? "positive-text" : "negative-text"}>{money(trade.pnl, true)}</td><td><span className={`score ${trade.discipline >= 90 ? "good" : "warn"}`}>{trade.discipline}%</span></td><td><button type="button" className={`trade-image-count ${images.length ? "has-images" : ""}`} disabled={!images.length} onClick={() => setActiveImage(images[0])} aria-label={images.length ? `Xem ${images.length} ảnh của ${trade.symbol}` : `${trade.symbol} chưa có ảnh`}><Camera size={13} />{images.length || "—"}</button></td><td><div className="table-actions"><button type="button" className="icon-button edit" onClick={() => openEditTradeModal(trade)} aria-label={`Sửa lệnh ${trade.symbol}`}><Pencil size={13} /></button><button type="button" className="icon-button delete" onClick={() => deleteTrade(trade.id)} aria-label={`Xóa lệnh ${trade.symbol}`}>×</button></div></td></tr>; })}
        </tbody></table></div><p className="table-scroll-hint">Giữ Shift + lăn chuột hoặc kéo ngang để xem đủ dữ liệu.</p></div><div className="journal-mobile-list">{journalTrades.map((trade) => { const images = imagesByTrade.get(trade.id) ?? []; return <article className="journal-trade-card" key={trade.id}><header><div><strong>{trade.symbol}</strong><span>{DATE.format(new Date(`${trade.date}T12:00:00`))} · {marketOf(trade)}</span></div><span className={`result ${trade.pnl > 0 ? "win" : trade.pnl < 0 ? "loss" : "be"}`}>{trade.pnl > 0 ? "Thắng" : trade.pnl < 0 ? "Thua" : "Hòa"}</span></header><div className="journal-trade-summary"><div><span>Lãi / Lỗ</span><strong className={trade.pnl >= 0 ? "positive-text" : "negative-text"}>{money(trade.pnl, true)}</strong></div><div><span>R:R</span><strong>{trade.risk ? (trade.pnl / trade.risk).toFixed(2) : "0.00"}R</strong></div><div><span>Kỷ luật</span><strong>{trade.discipline}%</strong></div></div><dl><div><dt>Hướng · Phiên</dt><dd>{trade.side} · {trade.session}</dd></div><div><dt>Setup · Khung</dt><dd>{trade.setup} · {trade.timeframe}</dd></div><div><dt>Nguồn</dt><dd>{trade.source ?? "Thủ công"}</dd></div></dl><footer><button type="button" className="ghost-button" disabled={!images.length} onClick={() => setActiveImage(images[0])}><Camera size={15} /> {images.length ? `${images.length} ảnh` : "Chưa có ảnh"}</button><button type="button" className="ghost-button" onClick={() => openEditTradeModal(trade)}><Pencil size={15} /> Sửa</button><button type="button" className="icon-button delete" onClick={() => deleteTrade(trade.id)} aria-label={`Xóa lệnh ${trade.symbol}`}>×</button></footer></article>; })}</div></> : <EmptyState title="Chưa có giao dịch phù hợp" copy="Thử thay đổi bộ lọc hoặc thêm một giao dịch mới." />}
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
    trades.filter((trade) => { const date = new Date(`${trade.date}T12:00:00`); return date.getFullYear() === year && date.getMonth() === month; }).forEach((trade) => {
      const day = Number(trade.date.slice(-2));
      tradesByDay.set(day, [...(tradesByDay.get(day) ?? []), trade]);
    });
    const monthLabel = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(calendarMonth);
    return <section className="calendar-panel panel"><div className="calendar-head"><button className="icon-button" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}>‹</button><div><span className="eyebrow">NHỊP ĐỘ GIAO DỊCH</span><h2>{monthLabel}</h2></div><button className="icon-button" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}>›</button></div><div className="weekdays">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => {
      const dayTrades = day ? tradesByDay.get(day) ?? [] : [];
      const pnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      return <div className={`calendar-day ${dayTrades.length ? pnl >= 0 ? "profit" : "loss" : ""}`} key={`${day}-${index}`}>{day && <><span className="day-number">{day}</span>{dayTrades.length > 0 && <div className="day-result"><strong>{money(pnl, true)}</strong><small>{dayTrades.length} lệnh</small></div>}</>}</div>;
    })}</div></section>;
  };

  const renderPerformance = (dimension: "symbol" | "setup" | "session" | "weekday", title?: string) => {
    const grouped = groupTrades(trades, dimension);
    const max = Math.max(...grouped.map((item) => Math.abs(item.pnl)), 1);
    const leader = grouped[0];
    const enoughSample = Boolean(leader && leader.count >= MIN_ANALYTICS_SAMPLE);
    return <div className="performance-grid"><section className="panel performance-main"><div className="panel-title"><div><span className="eyebrow">SO SÁNH HIỆU SUẤT</span><h3>{title ?? "Lợi nhuận theo nhóm"}</h3></div><small className="sample-rule">Ngưỡng kết luận: ≥ {MIN_ANALYTICS_SAMPLE} lệnh/nhóm</small></div><div className="horizontal-bars">{grouped.map((item, index) => <div className="horizontal-row" key={item.label}><div className="rank">{String(index + 1).padStart(2, "0")}</div><div className="bar-info"><div><strong>{item.label}</strong><span>{item.count} lệnh · {(item.wins / item.count * 100).toFixed(0)}% thắng · <em className={item.count >= MIN_ANALYTICS_SAMPLE ? "confidence-ready" : "confidence-low"}>{item.count >= MIN_ANALYTICS_SAMPLE ? "đủ mẫu" : "mẫu nhỏ"}</em></span></div><div className="bar-track"><i className={item.pnl >= 0 ? "up" : "down"} style={{ width: `${Math.max(8, Math.abs(item.pnl) / max * 100)}%` }} /></div></div><strong className={item.pnl >= 0 ? "positive-text" : "negative-text"}>{money(item.pnl, true)}</strong></div>)}</div></section><aside className={`panel insight-card ${enoughSample ? "" : "insufficient"}`}><span className="eyebrow">DIỄN GIẢI DỮ LIỆU</span><h3>{enoughSample ? "Lợi thế đã đủ mẫu" : "Chưa đủ dữ liệu để kết luận"}</h3><div className="insight-number">{leader?.label ?? "—"}</div><p>{leader ? enoughSample ? `${leader.label} đang dẫn đầu trên ${leader.count} giao dịch. Chỉ tăng tần suất khi điều kiện setup và mức rủi ro vẫn giữ nguyên.` : `${leader.label} hiện đứng đầu nhưng mới có ${leader.count} giao dịch. Cần thêm ít nhất ${Math.max(0, MIN_ANALYTICS_SAMPLE - leader.count)} lệnh cùng điều kiện trước khi coi đây là lợi thế.` : "Thêm giao dịch để hệ thống bắt đầu so sánh các nhóm."}</p><div className="insight-rule"><span>Nguyên tắc</span><strong>Không tăng rủi ro dựa trên mẫu nhỏ</strong></div></aside></div>;
  };

  const renderAnalytics = () => {
    const reliable = (dimension: "symbol" | "setup" | "session") => groupTrades(trades, dimension).find((item) => item.count >= MIN_ANALYTICS_SAMPLE)?.label ?? "Chưa đủ mẫu";
    const quality = trades.length >= 100 ? "Tốt" : trades.length >= 50 ? "Đang hình thành" : "Mẫu còn nhỏ";
    const analyticsOptions: Array<{ id: AnalyticsTab; label: string }> = [
      { id: "symbol", label: "Sản phẩm" },
      { id: "setup", label: "Setup" },
      { id: "session", label: "Phiên" },
      { id: "weekday", label: "Theo thứ" },
      { id: "heatmap", label: "Bản đồ nhiệt" },
    ];
    const titles: Record<Exclude<AnalyticsTab, "heatmap">, string> = {
      symbol: "Lãi / Lỗ theo sản phẩm",
      setup: "Lãi / Lỗ theo setup",
      session: "Lãi / Lỗ theo phiên",
      weekday: "Lãi / Lỗ theo ngày trong tuần",
    };
    return <>
      <div className="summary-row"><article><span>Sản phẩm đủ mẫu</span><strong>{reliable("symbol")}</strong></article><article><span>Setup đủ mẫu</span><strong>{reliable("setup")}</strong></article><article><span>Phiên đủ mẫu</span><strong>{reliable("session")}</strong></article><article><span>Chất lượng dữ liệu</span><strong className={trades.length >= 100 ? "positive-text" : "gold-text"}>{quality}</strong><small>{trades.length} giao dịch đã ghi</small></article></div>
      <section className="sample-method-banner"><ShieldCheck size={18} /><div><strong>Kết quả đang được kiểm soát theo cỡ mẫu</strong><p>Xếp hạng vẫn hiển thị để quan sát, nhưng chỉ được gọi là “lợi thế” khi một nhóm có ít nhất {MIN_ANALYTICS_SAMPLE} giao dịch cùng điều kiện.</p></div><a href="/phuong-phap">Đọc phương pháp</a></section>
      <div className="analytics-tabs" role="tablist" aria-label="Chiều phân tích">{analyticsOptions.map((option) => <button type="button" role="tab" aria-selected={analyticsTab === option.id} className={analyticsTab === option.id ? "active" : ""} key={option.id} onClick={() => setAnalyticsTab(option.id)}>{option.label}</button>)}</div>
      {analyticsTab === "heatmap" ? renderHeatmap() : renderPerformance(analyticsTab, titles[analyticsTab])}
    </>;
  };

  const renderRisk = () => {
    const riskRows = [
      { label: "Rủi ro trung bình / lệnh", value: trades.length ? trades.reduce((sum, t) => sum + t.risk, 0) / trades.length : 0, limit: 2000000 },
      { label: "Lệnh lỗ lớn nhất", value: Math.abs(allStats.biggestLoss), limit: 2000000 },
      { label: "Sụt giảm tối đa", value: allStats.maxDrawdown, limit: 6000000 },
    ];
    return <div className="risk-layout"><section className="panel"><div className="panel-title"><div><span className="eyebrow">HÀNG RÀO BẢO VỆ</span><h3>Giới hạn rủi ro</h3></div><span className="status-chip success">ĐANG TUÂN THỦ</span></div><div className="risk-list">{riskRows.map((row) => <div key={row.label}><div><span>{row.label}</span><strong>{money(row.value, true)} / {money(row.limit, true)}</strong></div><div className="risk-track"><i style={{ width: `${Math.min(100, row.value / row.limit * 100)}%` }} /></div></div>)}</div><div className="risk-rule-grid"><div><span>Rủi ro tối đa</span><strong>1.0%</strong><small>mỗi giao dịch</small></div><div><span>Dừng trong ngày</span><strong>−2R</strong><small>không trả thù</small></div><div><span>Tối đa mỗi ngày</span><strong>2</strong><small>giao dịch</small></div></div></section><section className="panel"><div className="panel-title"><div><span className="eyebrow">PHÂN PHỐI KẾT QUẢ</span><h3>Lợi nhuận theo R</h3></div></div><div className="r-distribution">{["≤ −1R", "−1R → 0", "0 → 1R", "1R → 2R", "> 2R"].map((bucket, index) => { const counts = [trades.filter(t => t.pnl / t.risk <= -1).length, trades.filter(t => t.pnl / t.risk > -1 && t.pnl < 0).length, trades.filter(t => t.pnl >= 0 && t.pnl / t.risk < 1).length, trades.filter(t => t.pnl / t.risk >= 1 && t.pnl / t.risk <= 2).length, trades.filter(t => t.pnl / t.risk > 2).length]; const maximum = Math.max(...counts, 1); return <div key={bucket}><span>{bucket}</span><i style={{ height: `${28 + counts[index] / maximum * 130}px` }} className={index < 2 ? "down" : "up"} /><strong>{counts[index]}</strong></div>; })}</div></section></div>;
  };

  const renderHeatmap = () => {
    const days = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
    const sessions: Trade["session"][] = ["Châu Á", "London", "New York"];
    const maximum = Math.max(...trades.map((trade) => Math.abs(trade.pnl)), 1);
    return <section className="panel heatmap-panel"><div className="panel-title"><div><span className="eyebrow">THỜI ĐIỂM GIAO DỊCH</span><h3>Ngày × Phiên</h3></div></div><div className="heatmap"><div />{sessions.map((session) => <strong key={session}>{session}</strong>)}{days.map((day) => <Fragment key={day}><span>{day.replace("Thứ ", "T")}</span>{sessions.map((session) => { const matching = trades.filter((trade) => dayName(trade.date) === day && trade.session === session); const pnl = matching.reduce((sum, trade) => sum + trade.pnl, 0); const opacity = matching.length ? .18 + Math.abs(pnl) / maximum * .55 : .04; return <div key={`${day}-${session}`} className={pnl >= 0 ? "cell-up" : "cell-down"} style={{ opacity }} title={`${day} · ${session}: ${money(pnl)}`}>{matching.length ? money(pnl, true) : "—"}</div>; })}</Fragment>)} </div><div className="heatmap-note"><span /> Lãi <span /> Lỗ <small>Màu đậm hơn = tác động lớn hơn</small></div></section>;
  };

  const renderProcess = () => {
    const phases = [
      {
        number: "01",
        phase: "TRƯỚC LỆNH",
        title: "Xây dựng luận điểm",
        copy: "Tách dữ kiện khách quan khỏi kỳ vọng trước khi tìm điểm vào.",
        checks: [
          ["Bối cảnh", "Xu hướng D1/H4, trạng thái biến động, vùng giá và tin tức quan trọng."],
          ["Lợi thế", "Gọi đúng tên setup trong playbook và nêu điều kiện kích hoạt cụ thể."],
          ["Kịch bản", "Ghi entry, invalidation, SL, TP và trường hợp chủ động đứng ngoài."],
        ],
        gate: "Chỉ giao dịch khi setup A+ đủ điều kiện và RR kỳ vọng từ 1:2.",
      },
      {
        number: "02",
        phase: "TRONG LỆNH",
        title: "Thực thi kế hoạch",
        copy: "Quản trị phần có thể kiểm soát; không phản ứng theo P&L tức thời.",
        checks: [
          ["Kích hoạt", "Chờ tín hiệu đóng nến hoặc xác nhận cấu trúc; tuyệt đối không đuổi giá."],
          ["Rủi ro", "Đúng khối lượng, rủi ro tối đa 1%; không nới SL hoặc trung bình giá lỗ."],
          ["Quản lý", "Dời SL, chốt một phần hoặc thoát lệnh đúng điều kiện đã viết trước."],
        ],
        gate: "Nếu phải thay đổi kế hoạch, ghi lý do trước khi hành động.",
      },
      {
        number: "03",
        phase: "SAU LỆNH",
        title: "Review quyết định",
        copy: "Đánh giá chất lượng quy trình độc lập với kết quả lời hay lỗ.",
        checks: [
          ["Bằng chứng", "Lưu ảnh trước/sau lệnh, kết quả theo R và số tiền thực tế."],
          ["Tuân thủ", "Chấm đúng setup, đúng rủi ro, đúng quản lý và trạng thái tâm lý."],
          ["Cải thiện", "Ghi một bài học kiểm chứng được và một hành động cho lệnh kế tiếp."],
        ],
        gate: `Không sửa hệ thống từ một lệnh; chỉ kết luận khi có ít nhất ${MIN_ANALYTICS_SAMPLE} mẫu cùng điều kiện.`,
      },
    ];
    const principles = [
      ["Bảo vệ vốn", "Rủi ro được xác định trước lợi nhuận."],
      ["Kỷ luật trước kết quả", "Một lệnh thắng sai quy trình vẫn là lệnh kém."],
      ["Đủ mẫu mới kết luận", `Ít nhất ${MIN_ANALYTICS_SAMPLE} lệnh cùng điều kiện.`],
      ["Đứng ngoài là một vị thế", "Không có setup A+ thì không cần giao dịch."],
    ];
    return <>
      <section className="process-hero">
        <div>
          <span className="eyebrow">EXECUTION PROTOCOL</span>
          <h2>Một quyết định tốt phải có thể giải thích và lặp lại</h2>
          <p>Đi từ dữ kiện đến kế hoạch, từ kế hoạch đến thực thi, rồi dùng dữ liệu để cải thiện — không dùng cảm xúc hoặc một kết quả đơn lẻ để thay đổi hệ thống.</p>
        </div>
        <div className="process-priority"><small>THỨ TỰ ƯU TIÊN</small><strong>Bảo vệ vốn <i>→</i> Tuân thủ <i>→</i> Kết quả</strong></div>
      </section>
      <section className="process-grid">{phases.map((phase) => <article className="process-card" key={phase.number}>
        <header><span>{phase.number}</span><div><small>{phase.phase}</small><h3>{phase.title}</h3><p>{phase.copy}</p></div></header>
        <div className="process-checklist">{phase.checks.map(([label, copy]) => <div key={label}><i>✓</i><p><strong>{label}</strong><span>{copy}</span></p></div>)}</div>
        <footer><ShieldCheck size={15} /><span><small>CỔNG KIỂM TRA</small><strong>{phase.gate}</strong></span></footer>
      </article>)}</section>
      <section className="process-principles"><div><span className="eyebrow">NGUYÊN TẮC BẤT BIẾN</span><h3>Giữ đúng hệ thống trước khi tối ưu kết quả</h3></div><div className="process-principle-grid">{principles.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{copy}</p></div></article>)}</div></section>
    </>;
  };

  const renderNotes = () => <>
    <section className="note-template-panel">
      <div className="note-template-heading"><div><span className="eyebrow">MẪU GHI CHUYÊN NGHIỆP</span><h3>Bắt đầu bằng đúng cấu trúc</h3></div><p>Mẫu mới được chèn nối tiếp, không ghi đè nội dung hiện có.</p></div>
      <div className="note-template-grid">{NOTE_TEMPLATES.map((template) => <button type="button" key={template.id} onClick={() => insertNoteTemplate(template)} aria-label={`Chèn mẫu ${template.label}`}><span>{template.code}</span><div><strong>{template.label}</strong><small>{template.description}</small></div><Copy size={15} /></button>)}</div>
    </section>
    <section className="notes-layout">
      <article className="panel note-editor">
        <div className="panel-title"><div><span className="eyebrow">DECISION JOURNAL</span><h3>Kế hoạch, bằng chứng & bài học</h3></div><span className="auto-save">Lưu trên thiết bị</span></div>
        <div className="note-writing-rule"><ShieldCheck size={16} /><p><strong>Quy tắc viết:</strong> ghi sự thật trước nhận định, mô tả quyết định trước kết quả và luôn kết thúc bằng một hành động cụ thể.</p></div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Ghi chú và review giao dịch" spellCheck="false" />
        <div className="note-editor-footer"><small>{notes.length.toLocaleString("vi-VN")} ký tự · Nội dung chỉ được lưu khi bạn bấm nút</small><button type="button" className="gold-button compact" onClick={saveNotes}>Lưu ghi chú</button></div>
      </article>
      <aside className="note-review-column">
        <section className="panel review-framework"><span className="eyebrow">REVIEW FRAMEWORK</span><h3>4 lớp đánh giá</h3><div>{[
          ["01", "Sự thật", "Điều gì đã xảy ra, có bằng chứng nào?"],
          ["02", "Quyết định", "Tại sao vào lệnh và điều kiện nào bị vi phạm?"],
          ["03", "Quy trình", "Kết quả đến từ lợi thế hay từ may mắn?"],
          ["04", "Hành động", "Một thay đổi nhỏ nào sẽ được đo ở lần tới?"],
        ].map(([number, title, copy]) => <article key={number}><span>{number}</span><p><strong>{title}</strong><small>{copy}</small></p></article>)}</div></section>
        <section className="panel weekly-card"><span className="eyebrow">REVIEW TUẦN</span><h3>Câu hỏi ra quyết định</h3><ol><li><strong>Lợi thế nào đã đủ mẫu?</strong><span>So sánh setup, phiên và sản phẩm trên cùng điều kiện.</span></li><li><strong>Sai lệch nào đang lặp lại?</strong><span>Đo tần suất và tác động, không chỉ kể lại cảm xúc.</span></li><li><strong>Tuần tới ưu tiên điều gì?</strong><span>Chọn một hành vi có thể quan sát và đo lường.</span></li></ol><div className="mindset"><span>NGUYÊN TẮC</span><strong>Đánh giá quy trình bằng dữ liệu; không đánh giá bản thân bằng một lệnh.</strong></div></section>
      </aside>
    </section>
  </>;

  const renderConnections = () => (
    <>
      <section className="security-banner">
        <div className="security-icon"><ShieldCheck size={20} /></div>
        <div><span className="eyebrow">KẾT NỐI AN TOÀN</span><h3>Một journal cho mọi thị trường</h3><p>API key và bridge token được mã hóa AES-GCM phía máy chủ. Mật khẩu, PIN/OTP và private key đặt lệnh luôn nằm ngoài journal.</p></div>
        <span className={`cloud-status ${dataMode}`}><i />{dataMode === "cloud" ? "Vùng dữ liệu riêng đã sẵn sàng" : "Đang lưu trên thiết bị"}</span>
      </section>
      <section className="auto-sync-banner">
        <span className="auto-sync-icon"><Radio size={19} /></span>
        <div>
          <span className="eyebrow">AUTO SYNC</span>
          <h3>Push 24/7 hoặc tự kéo dữ liệu mỗi 15 phút</h3>
          <p>VPS, SSI, TCX, MT5 và CQG có thể nhận push liên tục. Bật tùy chọn để kiểm tra Pull và Binance/Bybit mỗi 15 phút trong phiên này, hoặc bấm đồng bộ ngay.</p>
        </div>
        <div className="auto-sync-status"><label><input type="checkbox" checked={autoSyncEnabled} onChange={(event) => setAutoSyncEnabled(event.target.checked)} /> Bật tự đồng bộ 15 phút trong phiên này</label><small>{autoSyncStatus}</small><button type="button" className="ghost-button" disabled={autoSyncing || !connections.some(isAutoSyncConnection)} onClick={() => void syncAllConnections()}>{autoSyncing ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{autoSyncing ? "Đang đồng bộ…" : "Đồng bộ tất cả"}</button></div>
      </section>
      <section className="broker-grid">
        {BROKERS.map((broker) => {
          const connection = connections.find((item) => item.provider === broker.provider);
          const canSync = connection && isAutoSyncConnection(connection);
          return <article className={`broker-card broker-${broker.provider}`} key={broker.provider}>
            <div className="broker-head"><span className="broker-logo">{broker.badge}</span><div><h3>{broker.name}</h3><small>{broker.mode}</small></div><span className={`connection-state ${connection ? "connected" : "idle"}`}><i />{connection ? "Đã cấu hình" : "Chưa kết nối"}</span></div>
            <p>{broker.copy}</p>
            {connection && <div className="connection-meta"><span>{connection.label}</span><small>{isBridgeProvider(connection.provider) ? connection.accountType === "push" ? "Push 24/7 · tự nhận lệnh" : "Pull · kiểm tra mỗi 15 phút" : connection.lastSyncAt ? `Đồng bộ ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(connection.lastSyncAt))}` : "Chưa đồng bộ lần đầu"}</small>{isBridgeProvider(connection.provider) && connection.lastSyncAt && <small>Cập nhật {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(connection.lastSyncAt))}</small>}</div>}
            {broker.provider === "vn-broker" ? <div className="vn-import-controls"><select value={connectionDraft.brokerName} onChange={(e) => setConnectionDraft({ ...connectionDraft, brokerName: e.target.value })} aria-label="Chọn broker chứng khoán"><option>VPS</option><option>SSI</option><option>TCBS</option><option>VNDIRECT</option><option>MBS</option><option>HSC</option><option>Broker VN</option></select><label className="gold-button compact file-button">Nhập CSV<input type="file" accept=".csv,.txt,text/csv" multiple data-market="Chứng khoán" data-broker={connectionDraft.brokerName} onChange={importCsv} /></label></div> : <div className="broker-actions">{canSync && <button type="button" className="gold-button compact" disabled={syncingId === connection.id} onClick={() => void syncConnection(connection)}>{syncingId === connection.id ? "Đang đồng bộ…" : "Đồng bộ ngay"}</button>}<button type="button" className={`${connection ? "ghost-button" : "gold-button compact"} ${dataMode !== "cloud" ? "requires-cloud" : ""}`} onClick={() => openConnection(broker.provider)}>{connection ? broker.provider === "webhook" || (isBridgeProvider(broker.provider) && connection.accountType === "push") ? "Cập nhật / token" : "Cập nhật" : dataMode !== "cloud" ? "Cần cloud riêng" : broker.provider === "tradingview" ? "Xem thiết lập" : "Kết nối"}</button>{connection && <button type="button" className="icon-button delete" onClick={() => void disconnect(connection)} aria-label={`Ngắt ${broker.name}`}>×</button>}</div>}
            <div className="broker-foot"><span>{broker.scope}</span><span>Không đặt lệnh</span></div>
          </article>;
        })}
      </section>
      <section className="quick-import-panel panel">
        <div><span className="eyebrow">NHẬP NHANH ĐA THỊ TRƯỜNG</span><h3>Thả nhiều statement cùng lúc</h3><p>Khi broker chưa có API trực tiếp, xuất CSV rồi nhập một lần; hệ thống tự dò cột và chống trùng dữ liệu.</p></div>
        <div className="quick-import-grid">
          {([
            { market: "Chứng khoán", broker: "Broker chứng khoán", icon: "▥", copy: "VPS · SSI · TCBS · VNDIRECT…" },
            { market: "Forex", broker: "MT5 / Forex", icon: "↕", copy: "MT5 statement · cTrader export" },
            { market: "Crypto", broker: "Sàn Crypto", icon: "₿", copy: "Binance · Bybit · OKX…" },
            { market: "Hàng hóa", broker: "CQG / MXV", icon: "◈", copy: "CQG statement · broker hàng hóa" },
          ] as Array<{ market: Market; broker: string; icon: string; copy: string }>).map((item) => <label className="quick-import-card" key={item.market}><input type="file" accept=".csv,.txt,text/csv" multiple data-market={item.market} data-broker={item.broker} onChange={importCsv} /><span>{item.icon}</span><div><strong>{item.market}</strong><small>{item.copy}</small></div><FileUp size={15} /></label>)}
        </div>
      </section>
      <section className="sync-explainer panel"><div><span className="eyebrow">CHIẾN LƯỢC ĐỒNG BỘ</span><h3>Ba tầng để giảm tối đa nhập tay</h3></div><div className="sync-flow"><article><span>01</span><strong>Pull có lịch</strong><p>VPS, SSI, TCX, MT5, CQG, Binance và Bybit tự kiểm tra khi mở trang, sau đó lặp lại mỗi 15 phút.</p></article><article><span>02</span><strong>Push 24/7</strong><p>Bridge của 5 nền tảng gửi lệnh bất cứ lúc nào bằng token riêng, không cần mở app.</p></article><article><span>03</span><strong>Chỉ review phần quan trọng</strong><p>Lệnh mới được gắn “Chưa phân loại”; bạn chỉ sửa setup, rủi ro và checklist sau giao dịch.</p></article></div></section>
    </>
  );

  const renderSettings = () => <section className="settings-grid">
    <article className="panel settings-card"><div><span className="eyebrow">NHẬN DIỆN</span><h3>Hồ sơ nhật ký</h3></div><label>Tên hiển thị<input defaultValue="Tuan Trader" /></label><label>Khẩu hiệu<input defaultValue="Kỷ luật · Kiên định · Tăng trưởng" /></label><label>Tiền tệ<select defaultValue="VND"><option>VND</option><option>USD</option></select></label><button className="gold-button compact" onClick={() => setToast("Đã lưu cài đặt hiển thị.")}>Lưu thay đổi</button></article>
    <article className="panel settings-card"><div><span className="eyebrow">DỮ LIỆU & SAO LƯU</span><h3>Quản lý dữ liệu</h3></div><div className={`data-mode-card ${dataMode}`}><Database size={18} /><div><strong>{isDemo ? "Đang xem dữ liệu minh họa" : dataMode === "cloud" ? "Đồng bộ riêng tư đang hoạt động" : "Dữ liệu đang ở thiết bị này"}</strong><p>{isDemo ? "Các con số hiện tại chỉ để trải nghiệm tính năng, không phải kết quả giao dịch thật." : dataMode === "cloud" ? "Giao dịch được lưu trong vùng dữ liệu riêng." : "Nhật ký được lưu trong trình duyệt hiện tại; hãy xuất bản sao định kỳ để chuyển dữ liệu sang thiết bị khác."}</p></div></div>
      <div className="backup-actions"><button className="ghost-button full" onClick={exportBackup}><FileDown size={16} /> Xuất bản sao JSON</button><label className="ghost-button full file-button backup-file"><FileUp size={16} /> Nhập bản sao<input type="file" accept="application/json,.json" onChange={importBackup} /></label></div>
      {!isDemo && <button className="ghost-button full" onClick={restoreDemo}>Xem dữ liệu minh họa</button>}
      <button className="danger-button" onClick={clearAll}>{isDemo ? "Bắt đầu với nhật ký trống" : "Xóa toàn bộ giao dịch"}</button>
      <small className="backup-note">Bản sao không chứa API key, API secret hoặc token broker.</small>
    </article>
  </section>;

  const renderContent = () => {
    switch (view) {
      case "overview": return renderOverview();
      case "journal": return renderJournal();
      case "calendar": return renderCalendar();
      case "analytics": return renderAnalytics();
      case "risk": return renderRisk();
      case "statistics": return <TradingMetrix trades={trades} />;
      case "system-tracker": return <SystemTracker trades={trades} onOpenJournal={() => navigate("journal")} />;
      case "valuation": return <CompanyValuation />;
      case "pair": return renderPerformance("symbol", "Lãi / Lỗ theo sản phẩm");
      case "setup": return renderPerformance("setup", "Lãi / Lỗ theo setup");
      case "weekday": return renderPerformance("weekday", "Lãi / Lỗ theo ngày trong tuần");
      case "heatmap": return renderHeatmap();
      case "process": return renderProcess();
      case "notes": return renderNotes();
      case "connections": return renderConnections();
      case "settings": return renderSettings();
    }
  };

  const draftRiskValue = Number(draft.risk);
  const draftPnlValue = draft.pnl === "" ? null : Number(draft.pnl);
  const draftFeesValue = Number(draft.fees) || 0;
  const draftEntryValue = Number(draft.entryPrice);
  const draftStopValue = Number(draft.stopLoss);
  const draftTargetValue = Number(draft.takeProfit);
  const draftPriceRisk = draft.side === "Buy" ? draftEntryValue - draftStopValue : draftStopValue - draftEntryValue;
  const draftPriceReward = draft.side === "Buy" ? draftTargetValue - draftEntryValue : draftEntryValue - draftTargetValue;
  const draftHasPricePlan = draftEntryValue > 0 && draftStopValue > 0 && draftTargetValue > 0;
  const draftPlannedRr = draftHasPricePlan && draftPriceRisk > 0 && draftPriceReward > 0 ? draftPriceReward / draftPriceRisk : null;
  const draftNetPnl = draftPnlValue === null || !Number.isFinite(draftPnlValue) ? null : draftPnlValue - draftFeesValue;
  const draftActualR = draftNetPnl !== null && draftRiskValue > 0 ? draftNetPnl / draftRiskValue : null;
  const draftChecks = [draft.plan, draft.noFomo, draft.noRevenge, draft.screenshot];
  const draftDiscipline = Math.round((draftChecks.filter(Boolean).length / draftChecks.length) * 100);
  const draftRequired = [
    Boolean(draft.date),
    Boolean(draft.symbol.trim()),
    draft.setup !== UNCLASSIFIED_SETUP,
    Number.isFinite(draftRiskValue) && draftRiskValue > 0,
    draftPnlValue !== null && Number.isFinite(draftPnlValue),
  ];
  const draftQualitySignals = [...draftRequired, draftHasPricePlan, draft.screenshot || draftImages.length > 0, Boolean(draft.note.trim())];
  const draftCompleteness = Math.round((draftQualitySignals.filter(Boolean).length / draftQualitySignals.length) * 100);
  const draftReady = draftRequired.every(Boolean);
  const meta = VIEW_META[view];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><b /></div>
          <strong><span>Tuan</span> Trader</strong>
          <small>KỶ LUẬT · KIÊN ĐỊNH · TĂNG TRƯỞNG</small>
        </div>
        <nav aria-label="Điều hướng chính">{NAV_GROUPS.map((group) => <section className="nav-group" aria-label={group.label} key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} aria-current={view === item.id ? "page" : undefined} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon className="nav-icon" size={17} aria-hidden="true" />{item.label}</button>; })}</section>)}</nav>
        <div className="sidebar-footer"><button className="gold-button" onClick={openTradeModal}><Plus size={17} /> <span>Thêm giao dịch</span></button><div><span>{trades.length} lệnh</span><small>•</small><span>{isDemo ? "Dữ liệu mẫu" : money(allStats.net, true)}</span></div></div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" aria-label="Đóng menu" onClick={() => setMobileNav(false)} />}
      <main className="main-content" id="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Mở menu" onClick={() => setMobileNav(true)}><Menu size={18} /></button>
          <div><h1>{meta.title}</h1><p>{meta.subtitle}</p></div>
          <div className="top-actions"><span className={`data-state-chip ${isDemo ? "demo" : dataMode}`}><Database size={14} />{isDemo ? "Dữ liệu minh họa" : localFallback ? "Trên thiết bị · cloud trống" : dataMode === "cloud" ? "Đã đồng bộ" : "Trên thiết bị"}</span>{view === "overview" && <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Khoảng thời gian"><option value="all">Toàn bộ thời gian</option><option value="30">30 ngày qua</option><option value="90">90 ngày qua</option></select>}<button className="quick-add" onClick={openTradeModal}><Plus size={16} /> <span>Thêm lệnh</span></button></div>
        </header>
        <div className="content-area"><section className="hub-notice" aria-label="Chọn không gian làm việc"><strong>Web trước · đầy đủ công cụ</strong><p>Kết nối sàn, đồng bộ, ảnh, nhập báo cáo và cấu hình theo giao diện gốc. <a href="/v6/#overview">Mở sổ v6 đã khôi phục</a> · <a href="/legacy#connections">Nhập nhiều tài khoản / MT4–MT5</a>. Dữ liệu web trước và sổ v6 được lưu riêng; các thao tác ở đây không thay sổ v6.</p></section>
          {isDemo && <section className="demo-banner" role="status"><div className="demo-icon"><Sparkles size={18} /></div><div><span>CHẾ ĐỘ MINH HỌA</span><strong>Toàn bộ 20 giao dịch và +23,9 triệu đang hiển thị là dữ liệu mẫu</strong><p>Dữ liệu này dùng để trải nghiệm tính năng, không phải thành tích giao dịch thực tế hay bằng chứng về lợi nhuận.</p></div><div className="demo-actions"><button type="button" onClick={startRealJournal}>Bắt đầu nhật ký thật</button><a href="/phuong-phap">Xem phương pháp</a></div></section>}
          {renderContent()}
        </div>
        <footer className="app-footer"><div><span>Tuan Trader · Trading Plan Pro</span><small>{isDemo ? "Dữ liệu minh họa — không phải kết quả thực tế" : dataMode === "cloud" ? "Dữ liệu riêng đã đồng bộ" : "Dữ liệu đang lưu trên thiết bị"} · Không phải khuyến nghị đầu tư.</small></div><nav aria-label="Thông tin website"><a href="/phuong-phap">Phương pháp</a><a href="/bao-mat">Bảo mật dữ liệu</a></nav></footer>
      </main>

      {modalOpen && <div className="modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalOpen(false); setEditingTradeId(null); } }}><form className="trade-modal professional-trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-dialog-title" onSubmit={saveTrade}>
        <div className="modal-head trade-modal-head"><div><span className="eyebrow">TRADE EXECUTION RECORD</span><h2 id="trade-dialog-title">{editingTradeId ? "Cập nhật hồ sơ giao dịch" : "Ghi nhận giao dịch mới"}</h2><p>{editingTradeId ? "Hoàn thiện dữ liệu kế hoạch, kết quả và review cho lệnh đã có." : "Ghi dữ kiện trước, đánh giá quy trình sau — kết quả chỉ là một phần của hồ sơ."}</p></div><div className="trade-modal-head-actions"><span><i /> Trường có dấu * là bắt buộc</span><button type="button" className="modal-close" onClick={() => { setModalOpen(false); setEditingTradeId(null); }} aria-label="Đóng">×</button></div></div>
        <div className="trade-modal-workspace">
          <div className="trade-form-flow">
            <section className="form-section"><div className="form-section-title"><span>01</span><div><h3>Bối cảnh & setup</h3><p>Xác định chính xác lệnh nào đang được đánh giá</p></div></div>
              <div className="form-grid three">
                <label>Ngày giao dịch *<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required /></label>
                <label>Thị trường<select value={draft.market} onChange={(e) => setDraft({ ...draft, market: e.target.value as Market })}><option>Hàng hóa</option><option>Chứng khoán</option><option>Crypto</option><option>Forex</option></select></label>
                <label>Sản phẩm *<input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} placeholder="FPT, XAUUSD, BTCUSDT..." autoComplete="off" required /></label>
                <label>Phiên giao dịch<select value={draft.session} onChange={(e) => setDraft({ ...draft, session: e.target.value as Trade["session"] })}><option>Châu Á</option><option>London</option><option>New York</option></select></label>
                <label>Khung thời gian<select value={draft.timeframe} onChange={(e) => setDraft({ ...draft, timeframe: e.target.value })}>{!["Auto", "M1", "M5", "M15", "M30", "H1", "H4", "Daily", "Weekly"].includes(draft.timeframe) && <option value={draft.timeframe}>{draft.timeframe}</option>}<option>Auto</option><option>M1</option><option>M5</option><option>M15</option><option>M30</option><option>H1</option><option>H4</option><option>Daily</option><option>Weekly</option></select></label>
                <label>Hướng lệnh<div className="side-switch" role="group" aria-label="Hướng giao dịch"><button type="button" className={draft.side === "Buy" ? "active buy" : ""} aria-pressed={draft.side === "Buy"} onClick={() => setDraft({ ...draft, side: "Buy" })}>Buy</button><button type="button" className={draft.side === "Sell" ? "active sell" : ""} aria-pressed={draft.side === "Sell"} onClick={() => setDraft({ ...draft, side: "Sell" })}>Sell</button></div></label>
                <label className="span-two">Setup / Playbook *<select value={draft.setup} onChange={(e) => setDraft({ ...draft, setup: e.target.value })}>{draft.setup !== UNCLASSIFIED_SETUP && !SETUP_OPTIONS.includes(draft.setup) && <option value={draft.setup}>{draft.setup}</option>}<option>{UNCLASSIFIED_SETUP}</option>{SETUP_GROUPS.map((group) => <optgroup label={group.label} key={group.label}>{group.options.map((option) => <option key={option}>{option}</option>)}</optgroup>)}</select><small>Chọn đúng tên setup để dữ liệu phân tích không bị pha trộn.</small></label>
                <label>Tâm lý khi vào lệnh<select value={draft.psychology} onChange={(e) => setDraft({ ...draft, psychology: e.target.value })}><option>Chưa review</option><option>Bình tĩnh</option><option>Tự tin</option><option>Trung lập</option><option>Hơi vội</option><option>FOMO</option><option>Căng thẳng</option><option>Trả thù</option></select></label>
                <label className="span-three">Nguồn dữ liệu<select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>{!["Thủ công", "TradingView", "CSV · Broker VN", "MetaTrader 5", "Binance", "Bybit", "CQG / MXV", "Webhook tự động"].includes(draft.source) && <option value={draft.source}>{draft.source}</option>}<option>Thủ công</option><option>TradingView</option><option>CSV · Broker VN</option><option>MetaTrader 5</option><option>Binance</option><option>Bybit</option><option>CQG / MXV</option><option>Webhook tự động</option></select></label>
              </div>
            </section>
            <section className="form-section"><div className="form-section-title"><span>02</span><div><h3>Kế hoạch giá & rủi ro</h3><p>Ghi trước điểm vô hiệu và lợi nhuận kỳ vọng</p></div></div>
              <div className="form-grid three">
                <label>Rủi ro dự kiến (VNĐ) *<input type="number" inputMode="numeric" min="10000" step="10000" value={draft.risk} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, risk: normalizeNumericInput(e.target.value) })} placeholder="Ví dụ: 1.000.000" required /><small>Số tiền chấp nhận mất nếu SL bị chạm.</small></label>
                <label>Khối lượng<input type="number" inputMode="decimal" step="any" min="0" value={draft.quantity} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, quantity: normalizeNumericInput(e.target.value) })} placeholder="0.1 / 500" /></label>
                <label>Giá vào<input type="number" inputMode="decimal" step="any" min="0" value={draft.entryPrice} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, entryPrice: normalizeNumericInput(e.target.value) })} placeholder="Entry" /></label>
                <label>Giá cắt lỗ (SL)<input type="number" inputMode="decimal" step="any" min="0" value={draft.stopLoss} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, stopLoss: normalizeNumericInput(e.target.value) })} placeholder="Invalidation" /></label>
                <label>Giá chốt lời (TP)<input type="number" inputMode="decimal" step="any" min="0" value={draft.takeProfit} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, takeProfit: normalizeNumericInput(e.target.value) })} placeholder="Target" /></label>
                <div className={`planned-rr-card ${draftPlannedRr !== null && draftPlannedRr >= 2 ? "ready" : ""}`}><span>R:R KẾ HOẠCH</span><strong>{draftPlannedRr === null ? "—" : `1:${draftPlannedRr.toFixed(2)}`}</strong><small>{!draftHasPricePlan ? "Nhập Entry, SL và TP" : draftPlannedRr === null ? `Kiểm tra vị trí giá cho lệnh ${draft.side}` : draftPlannedRr >= 2 ? "Đạt ngưỡng kỳ vọng" : "Dưới ngưỡng 1:2"}</small></div>
              </div>
            </section>
            <section className="form-section"><div className="form-section-title"><span>03</span><div><h3>Kết quả thực tế</h3><p>Tách P&L trước phí và chi phí để giữ số liệu nhất quán</p></div></div>
              <div className="form-grid four">
                <label>P&L trước phí (VNĐ) *<input type="number" inputMode="numeric" step="10000" value={draft.pnl} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, pnl: normalizeNumericInput(e.target.value) })} placeholder="Lãi dương, lỗ âm" required /></label>
                <label>Phí giao dịch (VNĐ)<input type="number" inputMode="numeric" min="0" step="1000" value={draft.fees} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, fees: normalizeNumericInput(e.target.value) })} placeholder="0" /></label>
                <label>Giá thoát<input type="number" inputMode="decimal" step="any" min="0" value={draft.exitPrice} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, exitPrice: normalizeNumericInput(e.target.value) })} placeholder="Exit" /></label>
                <label>Thời gian giữ (phút)<input type="number" inputMode="numeric" min="0" value={draft.durationMin} onFocus={selectNumericInput} onChange={(e) => setDraft({ ...draft, durationMin: normalizeNumericInput(e.target.value) })} placeholder="Ví dụ: 90" /></label>
              </div>
              <div className="trade-result-preview"><article><span>P&L RÒNG SAU PHÍ</span><strong className={draftNetPnl === null ? "" : draftNetPnl >= 0 ? "positive-text" : "negative-text"}>{draftNetPnl === null ? "—" : money(draftNetPnl)}</strong></article><article><span>KẾT QUẢ THEO R</span><strong className={draftActualR === null ? "" : draftActualR >= 0 ? "positive-text" : "negative-text"}>{draftActualR === null ? "—" : `${draftActualR >= 0 ? "+" : ""}${draftActualR.toFixed(2)}R`}</strong></article><article><span>PHÂN LOẠI</span><strong>{draftNetPnl === null ? "Chưa có kết quả" : draftNetPnl > 0 ? "Lệnh thắng" : draftNetPnl < 0 ? "Lệnh thua" : "Hòa vốn"}</strong></article></div>
            </section>
            <section className="form-section"><div className="form-section-title"><span>04</span><div><h3>Checklist kỷ luật</h3><p>Chấm chất lượng quyết định độc lập với lời hoặc lỗ</p></div><strong className="discipline-live-score">{draftDiscipline}%</strong></div>
              <div className="check-grid professional-check-grid">{([
                ["plan", "Đúng setup & kế hoạch", "Có luận điểm, entry, invalidation và target rõ ràng"],
                ["noFomo", "Chờ đúng tín hiệu", "Không đuổi giá, không vào sớm vì FOMO"],
                ["noRevenge", "Đúng rủi ro & quản lý", "Không nới SL, gồng lỗ hoặc trả thù thị trường"],
                ["screenshot", "Đủ bằng chứng", "Có ảnh trước và sau lệnh để review"],
              ] as const).map(([key, label, description]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} /><span>✓</span><p><strong>{label}</strong><small>{description}</small></p></label>)}</div>
            </section>
            <section className="form-section"><div className="form-section-title"><span>05</span><div><h3>Bằng chứng & review</h3><p>Lưu ảnh, đối chiếu kế hoạch và chốt một hành động cải thiện</p></div></div>
              <div className="evidence-review-grid"><div><label className="trade-image-drop"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectDraftImages} /><ImagePlus size={22} /><strong>{draftImages.length ? `Đã chọn ${draftImages.length}/4 ảnh` : "Thêm ảnh trước / sau lệnh"}</strong><span>JPG, PNG, WEBP · tối đa 6 MB/ảnh</span></label>{draftImagePreviews.length > 0 && <div className="draft-image-grid">{draftImagePreviews.map((preview, index) => <figure key={`${preview.file.name}-${preview.file.lastModified}-${index}`}><img src={preview.url} alt={`Ảnh xem trước ${index + 1}`} /><figcaption><span>{preview.file.name}</span><button type="button" onClick={() => setDraftImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Bỏ ảnh ${preview.file.name}`}>×</button></figcaption></figure>)}</div>}</div>
                <div className="trade-review-field"><div><label htmlFor="trade-review-note">Review giao dịch</label><button type="button" onClick={insertTradeReviewTemplate}><BookOpen size={14} /> Chèn khung review</button></div><textarea id="trade-review-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Ghi dữ kiện, sai lệch, bài học và một hành động cụ thể..." /><small>Không thay đổi hệ thống chỉ vì một lệnh; hãy ghi điều có thể kiểm chứng.</small></div>
              </div>
            </section>
          </div>
          <aside className="trade-form-summary" aria-label="Tóm tắt giao dịch">
            <div className="trade-summary-head"><span className="eyebrow">TRADE SNAPSHOT</span><strong>{draft.symbol.trim().toUpperCase() || "CHƯA NHẬP MÃ"}</strong><small>{draft.market} · {draft.side} · {draft.timeframe}</small></div>
            <span className={`trade-ready-state ${draftReady ? "ready" : "pending"}`}><i />{draftReady ? "Đủ dữ liệu bắt buộc" : "Cần hoàn thiện dữ liệu"}</span>
            <div className="trade-summary-metrics"><article><span>R:R kế hoạch</span><strong>{draftPlannedRr === null ? "—" : `1:${draftPlannedRr.toFixed(2)}`}</strong></article><article><span>Kết quả</span><strong>{draftActualR === null ? "—" : `${draftActualR >= 0 ? "+" : ""}${draftActualR.toFixed(2)}R`}</strong></article><article><span>Kỷ luật</span><strong>{draftDiscipline}%</strong></article><article><span>Hồ sơ</span><strong>{draftCompleteness}%</strong></article></div>
            <div className="trade-summary-checks"><span>KIỂM TRA TRƯỚC KHI LƯU</span>{[
              [Boolean(draft.date && draft.symbol.trim()), "Ngày và sản phẩm"],
              [draft.setup !== UNCLASSIFIED_SETUP, "Setup đã phân loại"],
              [Number.isFinite(draftRiskValue) && draftRiskValue > 0, "Rủi ro dự kiến hợp lệ"],
              [draftPnlValue !== null && Number.isFinite(draftPnlValue), "P&L trước phí"],
              [draftHasPricePlan && draftPlannedRr !== null, "Entry · SL · TP hợp lệ"],
              [draft.screenshot || draftImages.length > 0, "Ảnh trước / sau lệnh"],
              [Boolean(draft.note.trim()), "Review có hành động"],
            ].map(([done, label]) => <div className={done ? "done" : ""} key={String(label)}><i>{done ? "✓" : "·"}</i><span>{label}</span></div>)}</div>
            <div className="trade-summary-principle"><ShieldCheck size={16} /><p><span>NGUYÊN TẮC</span><strong>Chất lượng hồ sơ quan trọng hơn việc cố làm đẹp kết quả.</strong></p></div>
          </aside>
        </div>
        <div className="modal-actions professional-modal-actions"><div><span className={draftReady ? "ready" : ""}><i />{draftReady ? "Sẵn sàng lưu" : "Còn thiếu trường bắt buộc"}</span><small>{draftCompleteness}% độ hoàn thiện hồ sơ</small></div><button type="button" className="ghost-button" onClick={() => { setModalOpen(false); setEditingTradeId(null); }}>Hủy</button><button type="submit" className="gold-button compact">{editingTradeId ? "Lưu thay đổi" : "Lưu giao dịch"}</button></div>
      </form></div>}
      {connectProvider && <div className="modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setConnectProvider(null); setWebhookToken(""); } }}><form className="connection-modal" role="dialog" aria-modal="true" aria-labelledby="connection-dialog-title" onSubmit={saveConnection}>
        <div className="modal-head"><div><span className="eyebrow">BROKER CONNECTION</span><h2 id="connection-dialog-title">{BROKERS.find((broker) => broker.provider === connectProvider)?.name}</h2><p>{BROKERS.find((broker) => broker.provider === connectProvider)?.mode}</p></div><button type="button" className="modal-close" onClick={() => { setConnectProvider(null); setWebhookToken(""); }} aria-label="Đóng">×</button></div>
        {connectProvider === "webhook" ? <div className="connection-body">
          {webhookToken ? <>
            <div className="connection-notice amber"><KeyRound size={18} /><div><strong>Lưu token ngay — chỉ hiển thị một lần</strong><p>Nếu mất token, hãy tạo token mới; token cũ sẽ ngừng hoạt động.</p></div></div>
            <div className="webhook-token-box"><span>BEARER TOKEN</span><code>{webhookToken}</code><button type="button" onClick={() => void copyWebhookToken()}><Copy size={15} /> Sao chép token</button></div>
            <label className="code-label">Endpoint nhận lệnh<pre>POST {WEBHOOK_ENDPOINT}</pre></label>
            <p className="connection-help">Bridge gửi header <b>Authorization: Bearer TOKEN</b>. Mỗi lệnh cần externalId, market và symbol; hệ thống chống nhập trùng theo mã lệnh.</p>
          </> : <>
            <div className="connection-notice"><KeyRound size={18} /><div><strong>Một token riêng cho bridge giao dịch</strong><p>Token chỉ dùng để ghi lệnh vào journal, không có quyền đọc dữ liệu hoặc đặt lệnh broker.</p></div></div>
            <label>Tên kết nối<input value={connectionDraft.label} onChange={(e) => setConnectionDraft({ ...connectionDraft, label: e.target.value })} placeholder="Ví dụ: Bridge broker riêng" required /></label>
            <div className="webhook-flow"><div><b>Broker / sàn</b><span>Khớp hoặc đóng lệnh</span></div><i>→</i><div><b>Bridge</b><span>Chuẩn hóa JSON</span></div><i>→</i><div><b>Journal</b><span>Tự chống trùng</span></div></div>
            <label className="code-label">Mẫu payload<pre>{`{
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
}`}</pre></label>
            <p className="connection-help">Market nhận: Chứng khoán, Forex, Crypto và Hàng hóa. Có thể gửi một lệnh, một mảng hoặc {`{"trades": [...]}`} tối đa 500 lệnh/lần.</p>
          </>}
        </div> : isBridgeProvider(connectProvider) ? <div className="connection-body">
          {webhookToken ? <>
            <div className="connection-notice amber"><KeyRound size={18} /><div><strong>Lưu token {BRIDGE_DETAILS[connectProvider].source} ngay</strong><p>Token chỉ hiển thị lần này. Tạo token mới sẽ vô hiệu token cũ.</p></div></div>
            <div className="webhook-token-box"><span>BEARER TOKEN</span><code>{webhookToken}</code><button type="button" onClick={() => void copyWebhookToken()}><Copy size={15} /> Sao chép token</button></div>
            <label className="code-label">Endpoint Push 24/7<pre>POST {WEBHOOK_ENDPOINT}</pre></label>
            <p className="connection-help">Gửi header <b>Authorization: Bearer TOKEN</b>. Với {BRIDGE_DETAILS[connectProvider].source}, market mặc định là <b>{BRIDGE_DETAILS[connectProvider].market}</b>; chỉ cần externalId và symbol để định danh lệnh.</p>
          </> : <>
            <div className="connection-notice"><ShieldCheck size={18} /><div><strong>Bridge tách biệt khỏi tài khoản giao dịch</strong><p>{BRIDGE_DETAILS[connectProvider].notice}</p></div></div>
            <label>Tên kết nối<input value={connectionDraft.label} onChange={(e) => setConnectionDraft({ ...connectionDraft, label: e.target.value })} required /></label>
            <div className="sync-mode-options" role="group" aria-label="Chọn chế độ đồng bộ">
              <button type="button" className={connectionDraft.accountType === "push" ? "active" : ""} onClick={() => setConnectionDraft({ ...connectionDraft, accountType: "push" })}><strong>Push 24/7</strong><span>Khuyên dùng · bridge chủ động gửi</span></button>
              <button type="button" className={connectionDraft.accountType === "pull" ? "active" : ""} onClick={() => setConnectionDraft({ ...connectionDraft, accountType: "pull" })}><strong>Pull bridge</strong><span>Kiểm tra khi mở app + mỗi 15 phút</span></button>
            </div>
            {connectionDraft.accountType === "push" ? <>
              {BRIDGE_DETAILS[connectProvider].foreignCurrency && <label>Tỷ giá tiền tài khoản → VNĐ<input type="number" min="1" value={connectionDraft.fxRate} onFocus={selectNumericInput} onChange={(e) => setConnectionDraft({ ...connectionDraft, fxRate: normalizeNumericInput(e.target.value) })} /><small>P/L, risk và phí từ bridge sẽ được nhân với tỷ giá này.</small></label>}
              <div className="webhook-flow"><div><b>{BRIDGE_DETAILS[connectProvider].source}</b><span>Lệnh đã khớp/đóng</span></div><i>→</i><div><b>Bridge 24/7</b><span>Gửi JSON bảo mật</span></div><i>→</i><div><b>Journal</b><span>Chống trùng tự động</span></div></div>
              <label className="code-label">Payload tối thiểu mở rộng<pre>{bridgePayloadExample(connectProvider)}</pre></label>
              <p className="connection-help">Sau khi lưu, app cấp một token ghi dữ liệu riêng. Bridge có thể gửi một object, một mảng hoặc {`{"trades": [...]}`} tối đa 500 lệnh/lần.</p>
            </> : <>
              <div className="form-grid two"><label>Bridge HTTPS<input type="url" value={connectionDraft.bridgeUrl} onChange={(e) => setConnectionDraft({ ...connectionDraft, bridgeUrl: e.target.value })} placeholder="https://bridge-cua-ban.example/trades" required /></label><label>Bridge token<input type="password" autoComplete="new-password" value={connectionDraft.bridgeToken} onChange={(e) => setConnectionDraft({ ...connectionDraft, bridgeToken: e.target.value })} required /></label></div>
              {BRIDGE_DETAILS[connectProvider].foreignCurrency && <label>Tỷ giá tiền tài khoản → VNĐ<input type="number" min="1" value={connectionDraft.fxRate} onFocus={selectNumericInput} onChange={(e) => setConnectionDraft({ ...connectionDraft, fxRate: normalizeNumericInput(e.target.value) })} /><small>P/L, risk và phí từ bridge sẽ được nhân với tỷ giá này.</small></label>}
              <label className="code-label">Response bridge được chấp nhận<pre>{`[{ ...trade }]
hoặc
{ "trades": [{ ...trade }] }`}</pre></label>
              <p className="connection-help">Journal gọi endpoint HTTPS với header Bearer, nhận tối đa 1.000 lệnh/lần và tự chống trùng bằng externalId.</p>
            </>}
          </>}
        </div> : connectProvider === "tradingview" ? <div className="connection-body"><div className="connection-notice amber"><span>!</span><div><strong>TradingView gửi alert bằng webhook</strong><p>Dùng Auto Import Hub làm endpoint bảo mật. Không đưa mật khẩu broker vào nội dung alert.</p></div></div><div className="webhook-flow"><div><b>TradingView</b><span>Alert JSON</span></div><i>→</i><div><b>Bridge</b><span>Ghép kết quả lệnh</span></div><i>→</i><div><b>Tuan Trader</b><span>Gắn vào journal</span></div></div><label className="code-label">Mẫu JSON alert<pre>{`{
  "symbol": "{{ticker}}",
  "side": "BUY",
  "price": "{{close}}",
  "time": "{{timenow}}",
  "market": "Crypto"
}`}</pre></label><p className="connection-help">Alert là tín hiệu; kết quả P/L nên lấy từ execution của Binance, Bybit, MT5 hoặc bridge broker để tránh ghi nhận sai.</p></div> : connectProvider === "vn-broker" ? <div className="connection-body"><div className="connection-notice"><span>CSV</span><div><strong>Định dạng được nhận tự động</strong><p>App dò các cột tương đương: ngày, mã, mua/bán, khối lượng, giá, phí và lãi/lỗ.</p></div></div><label>Broker<select value={connectionDraft.brokerName} onChange={(e) => setConnectionDraft({ ...connectionDraft, brokerName: e.target.value })}><option>VPS</option><option>SSI</option><option>TCBS</option><option>VNDIRECT</option><option>MBS</option><option>HSC</option><option>Broker VN</option></select></label><label className="gold-button compact file-button large">Chọn file CSV<input type="file" accept=".csv,.txt,text/csv" multiple data-market="Chứng khoán" data-broker={connectionDraft.brokerName} onChange={(event) => { void importCsv(event); setConnectProvider(null); }} /></label></div> : <div className="connection-body">
          <div className="connection-notice"><span>◇</span><div><strong>Chỉ cấp quyền đọc lịch sử</strong><p>Tắt quyền Trade và Withdraw. API secret được mã hóa trước khi lưu.</p></div></div>
          <div className="form-grid two"><label>Tên kết nối<input value={connectionDraft.label} onChange={(e) => setConnectionDraft({ ...connectionDraft, label: e.target.value })} required /></label><label>Loại tài khoản<select value={connectionDraft.accountType} onChange={(e) => setConnectionDraft({ ...connectionDraft, accountType: e.target.value })}><option value={connectProvider === "bybit" ? "linear" : "futures"}>Phái sinh / Futures</option><option value="spot">Spot</option></select></label></div>
          <><div className="form-grid two"><label>API key<input type="password" autoComplete="new-password" value={connectionDraft.apiKey} onChange={(e) => setConnectionDraft({ ...connectionDraft, apiKey: e.target.value })} required /></label><label>API secret<input type="password" autoComplete="new-password" value={connectionDraft.apiSecret} onChange={(e) => setConnectionDraft({ ...connectionDraft, apiSecret: e.target.value })} required /></label></div>{connectProvider === "binance" && <label>Symbols cần đồng bộ<input value={connectionDraft.symbols} onChange={(e) => setConnectionDraft({ ...connectionDraft, symbols: e.target.value })} placeholder="BTCUSDT, ETHUSDT" /></label>}</>
          <label>Tỷ giá USD/USDT → VNĐ<input type="number" min="1" value={connectionDraft.fxRate} onFocus={selectNumericInput} onChange={(e) => setConnectionDraft({ ...connectionDraft, fxRate: normalizeNumericInput(e.target.value) })} /><small>Dùng để hợp nhất P/L crypto và forex vào dashboard VNĐ.</small></label>
        </div>}
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={() => { setConnectProvider(null); setWebhookToken(""); }}>{webhookToken ? "Đóng" : "Hủy"}</button>{connectProvider === "tradingview" ? <button type="submit" className="gold-button compact">Đã hiểu</button> : connectProvider === "webhook" || (isBridgeProvider(connectProvider) && connectionDraft.accountType === "push") ? webhookToken ? <button type="button" className="gold-button compact" onClick={() => { setConnectProvider(null); setWebhookToken(""); }}>Đã lưu token</button> : <button type="submit" className="gold-button compact">{connectProvider === "webhook" ? "Tạo khóa bảo mật" : "Tạo kết nối & token"}</button> : connectProvider !== "vn-broker" && <button type="submit" className="gold-button compact">Lưu kết nối</button>}</div>
      </form></div>}
      {activeImage && <div className="image-viewer-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveImage(null); }}><section className="image-viewer" role="dialog" aria-modal="true" aria-labelledby="image-viewer-title"><header><div><span className="eyebrow">ẢNH GIAO DỊCH</span><h2 id="image-viewer-title">{activeImageTrade?.symbol ?? "Biểu đồ"} · {activeImageTrade?.side ?? ""}</h2><p>{activeImageTrade ? DATE.format(new Date(`${activeImageTrade.date}T12:00:00`)) : ""} · {activeImage.filename}</p></div><button type="button" onClick={() => setActiveImage(null)} aria-label="Đóng ảnh">×</button></header><div className="image-viewer-stage"><img src={activeImage.url} alt={`Biểu đồ ${activeImageTrade?.symbol ?? "giao dịch"}`} /></div>{activeImageSiblings.length > 1 && <div className="image-viewer-thumbs">{activeImageSiblings.map((image) => <button type="button" className={image.id === activeImage.id ? "active" : ""} key={image.id} onClick={() => setActiveImage(image)}><img src={image.url} alt={image.filename} /></button>)}</div>}<footer><span>{(activeImage.sizeBytes / 1024 / 1024).toFixed(1)} MB · lưu riêng tư</span><button type="button" className="image-delete-button" onClick={() => void deleteTradeImage(activeImage)}><Trash2 size={15} /> Xóa ảnh</button></footer></section></div>}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}
