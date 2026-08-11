­r‡^Ñf¥–Ø¦{O,yÊ'vÃ®¶›­"use client";

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
  LogOut,
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
  UserRound,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import CompanyValuation from "./components/CompanyValuation";
import EquityTimeChart, { type EquityChartPoint } from "./components/EquityTimeChart";
import SystemTracker from "./components/SystemTracker";
import TradingMetrix from "./components/TradingMetrix";
import { normalizeNumericInput, selectNumericInput } from "./components/numeric-input";
import { authClient } from "../lib/auth-client";

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

type Market = "HÃ ng hÃ³a" | "Chá»©ng khoÃ¡n" | "Crypto" | "Forex";
type BridgeProvider = "vps" | "ssi" | "tcx" | "mt5" | "cqg";
type Provider = BridgeProvider | "binance" | "bybit" | "tradingview" | "vn-broker" | "webhook";
type AnalyticsTab = "symbol" | "setup" | "session" | "weekday" | "heatmap";

type Trade = {
  id: string;
  date: string;
  symbol: string;
  side: "Buy" | "Sell";
  session: "ChÃ¢u Ã" | "London" | "New York";
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
  { id: "T260710", date: "2026-07-10", symbol: "Báº C", side: "Buy", session: "New York", setup: "Breakout + Retest", timeframe: "H1", risk: 1200000, pnl: 2800000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Chá» giÃ¡ retest vÃ¹ng phÃ¡ vá»¡, khá»‘i lÆ°á»£ng xÃ¡c nháº­n.", durationMin: 185 },
  { id: "T260713", date: "2026-07-13", symbol: "Dáº¦U WTI", side: "Sell", session: "New York", setup: "Tá»« chá»‘i giÃ¡", timeframe: "M30", risk: 1100000, pnl: -1100000, discipline: 75, psychology: "HÆ¡i vá»™i", note: "VÃ o sá»›m trÆ°á»›c tÃ­n hiá»‡u xÃ¡c nháº­n.", durationMin: 72 },
  { id: "T260715", date: "2026-07-15", symbol: "ROBUSTA", side: "Buy", session: "London", setup: "Pullback xu hÆ°á»›ng", timeframe: "H1", risk: 1300000, pnl: 2150000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Giá»¯ Ä‘Ãºng káº¿ hoáº¡ch, chá»‘t táº¡i vÃ¹ng cung gáº§n nháº¥t.", durationMin: 246 },
  { id: "T260717", date: "2026-07-17", symbol: "Äáº¬U TÆ¯Æ NG", side: "Sell", session: "ChÃ¢u Ã", setup: "PhÃ¡ cáº¥u trÃºc", timeframe: "H4", risk: 900000, pnl: 0, discipline: 100, psychology: "Trung láº­p", note: "Dá»i hÃ²a vá»‘n khi giÃ¡ Ä‘áº¡t 1R.", durationMin: 390 },
  { id: "T260720", date: "2026-07-20", symbol: "Äá»’NG", side: "Buy", session: "London", setup: "Breakout + Retest", timeframe: "M30", risk: 1000000, pnl: 1800000, discipline: 100, psychology: "Tá»± tin", note: "Setup rÃµ, tá»· lá»‡ R:R tá»‘t.", durationMin: 128 },
  { id: "T260722", date: "2026-07-22", symbol: "Báº C", side: "Sell", session: "New York", setup: "Tá»« chá»‘i giÃ¡", timeframe: "M15", risk: 1250000, pnl: -1250000, discipline: 50, psychology: "FOMO", note: "Giao dá»‹ch ngoÃ i khung giá» káº¿ hoáº¡ch.", durationMin: 34 },
  { id: "T260724", date: "2026-07-24", symbol: "Dáº¦U WTI", side: "Buy", session: "New York", setup: "Pullback xu hÆ°á»›ng", timeframe: "H1", risk: 1150000, pnl: 2450000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "KhÃ´ng Ä‘uá»•i giÃ¡, chá» vÃ¹ng cáº§u.", durationMin: 211 },
  { id: "T260727", date: "2026-07-27", symbol: "ROBUSTA", side: "Sell", session: "London", setup: "PhÃ¡ cáº¥u trÃºc", timeframe: "H1", risk: 1050000, pnl: -620000, discipline: 75, psychology: "Trung láº­p", note: "ÄÃ³ng sá»›m khi cáº¥u trÃºc ngáº¯n háº¡n thay Ä‘á»•i.", durationMin: 156 },
  { id: "T260729", date: "2026-07-29", symbol: "NGÃ”", side: "Buy", session: "ChÃ¢u Ã", setup: "TÃ­ch lÅ©y", timeframe: "H4", risk: 800000, pnl: 1520000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Khá»‘i lÆ°á»£ng tÄƒng táº¡i Ä‘Ã¡y vÃ¹ng giÃ¡ trá»‹.", durationMin: 510 },
  { id: "T260801", date: "2026-08-01", symbol: "Báº C", side: "Buy", session: "New York", setup: "Breakout + Retest", timeframe: "H1", risk: 1200000, pnl: 3200000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Lá»‡nh A+, Ä‘á»§ checklist.", durationMin: 198 },
  { id: "T260803", date: "2026-08-03", symbol: "Dáº¦U WTI", side: "Sell", session: "New York", setup: "Tá»« chá»‘i giÃ¡", timeframe: "M30", risk: 1200000, pnl: -1200000, discipline: 75, psychology: "CÄƒng tháº³ng", note: "Khá»‘i lÆ°á»£ng nhá» Ä‘Ãºng má»©c rá»§i ro.", durationMin: 88 },
  { id: "T260804", date: "2026-08-04", symbol: "Äá»’NG", side: "Buy", session: "London", setup: "Pullback xu hÆ°á»›ng", timeframe: "H1", risk: 1000000, pnl: 1950000, discipline: 100, psychology: "Tá»± tin", note: "Giá»¯ lá»‡nh theo trailing swing low.", durationMin: 275 },
  { id: "T260805", date: "2026-08-05", symbol: "Äáº¬U TÆ¯Æ NG", side: "Sell", session: "ChÃ¢u Ã", setup: "PhÃ¡ cáº¥u trÃºc", timeframe: "H4", risk: 900000, pnl: -900000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Thua Ä‘Ãºng káº¿ hoáº¡ch, khÃ´ng vÃ o láº¡i.", durationMin: 340 },
  { id: "T260806", date: "2026-08-06", symbol: "ROBUSTA", side: "Buy", session: "London", setup: "TÃ­ch lÅ©y", timeframe: "H1", risk: 1100000, pnl: 2640000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "TÃ­n hiá»‡u volume xÃ¡c nháº­n ngay vÃ¹ng há»— trá»£.", durationMin: 224 },
  { id: "S260728", date: "2026-07-28", symbol: "FPT", side: "Buy", session: "ChÃ¢u Ã", setup: "Breakout ná»n giÃ¡", timeframe: "Daily", risk: 1500000, pnl: 3100000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Cá»• phiáº¿u dáº«n dáº¯t, thanh khoáº£n xÃ¡c nháº­n.", durationMin: 4320, market: "Chá»©ng khoÃ¡n", source: "CSV Â· Broker VN", quantity: 500, fees: 180000 },
  { id: "S260805", date: "2026-08-05", symbol: "SSI", side: "Buy", session: "ChÃ¢u Ã", setup: "Pullback xu hÆ°á»›ng", timeframe: "Daily", risk: 1200000, pnl: -850000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Cáº¯t lá»— Ä‘Ãºng ngÆ°á»¡ng khi máº¥t há»— trá»£.", durationMin: 2880, market: "Chá»©ng khoÃ¡n", source: "CSV Â· Broker VN", quantity: 1000, fees: 145000 },
  { id: "C260730", date: "2026-07-30", symbol: "BTCUSDT", side: "Buy", session: "New York", setup: "Breakout + Retest", timeframe: "H4", risk: 1800000, pnl: 4250000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "Binance Futures Â· dá»¯ liá»‡u minh há»a.", durationMin: 560, market: "Crypto", source: "Binance", quantity: 0.035, fees: 92000 },
  { id: "C260804", date: "2026-08-04", symbol: "ETHUSDT", side: "Sell", session: "New York", setup: "Tá»« chá»‘i giÃ¡", timeframe: "H1", risk: 1000000, pnl: -1000000, discipline: 75, psychology: "HÆ¡i vá»™i", note: "Bybit Â· dá»¯ liá»‡u minh há»a.", durationMin: 95, market: "Crypto", source: "Bybit", quantity: 0.4, fees: 62000 },
  { id: "F260729", date: "2026-07-29", symbol: "EURUSD", side: "Buy", session: "London", setup: "PhÃ¡ cáº¥u trÃºc", timeframe: "H1", risk: 1000000, pnl: 2070000, discipline: 100, psychology: "BÃ¬nh tÄ©nh", note: "MT5 Â· Ä‘Ã³ng táº¡i vÃ¹ng cung H4.", durationMin: 210, market: "Forex", source: "MetaTrader 5", quantity: 0.2, fees: 75000 },
  { id: "F260806", date: "2026-08-06", symbol: "XAUUSD", side: "Sell", session: "New York", setup: "Tá»« chá»‘i giÃ¡", timeframe: "M30", risk: 1300000, pnl: 2860000, discipline: 100, psychology: "Tá»± tin", note: "TradingView alert + MT5 execution.", durationMin: 135, market: "Forex", source: "TradingView", quantity: 0.1, fees: 110000 },
];

for (const trade of SAMPLE_TRADES) {
  trade.market ??= "HÃ ng hÃ³a";
  trade.source ??= "Thá»§ cÃ´ng";
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
    label: "Nháº­t kÃ½",
    items: [
      { id: "overview", label: "Tá»•ng quan", icon: LayoutDashboard },
      { id: "journal", label: "Nháº­t kÃ½ giao dá»‹ch", icon: BookOpen },
      { id: "calendar", label: "Lá»‹ch giao dá»‹ch", icon: CalendarDays },
      { id: "process", label: "Quy trÃ¬nh setup", icon: ListChecks },
      { id: "notes", label: "Ghi chÃº & review", icon: NotebookPen },
    ],
  },
  {
    label: "PhÃ¢n tÃ­ch",
    items: [
      { id: "analytics", label: "Lá»£i tháº¿ thá»‘ng kÃª", icon: BarChart3 },
      { id: "risk", label: "Lá»£i nhuáº­n & rá»§i ro", icon: ShieldCheck },
      { id: "statistics", label: "Trading MetriX", icon: Gauge },
      { id: "system-tracker", label: "Theo dÃµi há»‡ thá»‘ng", icon: History },
    ],
  },
  {
    label: "CÃ´ng cá»¥",
    items: [
      { id: "valuation", label: "Äá»‹nh giÃ¡ doanh nghiá»‡p", icon: Building2 },
      { id: "connections", label: "Káº¿t ná»‘i dá»¯ liá»‡u", icon: PlugZap },
    ],
  },
  {
    label: "Há»‡ thá»‘ng",
    items: [{ id: "settings", label: "CÃ i Ä‘áº·t & sao lÆ°u", icon: Settings }],
  },
];

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  overview: { title: "Nháº­t kÃ½ giao dá»‹ch Ä‘a thá»‹ trÆ°á»ng", subtitle: "Tá»•ng quan hiá»‡u suáº¥t Â· Ká»· luáº­t Â· Quáº£n trá»‹ rá»§i ro" },
  journal: { title: "Nháº­t kÃ½ giao dá»‹ch", subtitle: "Má»—i lá»‡nh lÃ  má»™t dá»¯ liá»‡u Ä‘á»ƒ báº¡n tiáº¿n bá»™" },
  calendar: { title: "Lá»‹ch giao dá»‹ch", subtitle: "NhÃ¬n láº¡i nhá»‹p Ä‘á»™ vÃ  káº¿t quáº£ theo ngÃ y" },
  analytics: { title: "PhÃ¢n tÃ­ch", subtitle: "TÃ¬m lá»£i tháº¿ tháº­t sá»± trong dá»¯ liá»‡u giao dá»‹ch" },
  risk: { title: "Lá»£i nhuáº­n Â· Rá»§i ro", subtitle: "Báº£o vá»‡ vá»‘n trÆ°á»›c khi nghÄ© Ä‘áº¿n lá»£i nhuáº­n" },
  statistics: { title: "Trading MetriX", subtitle: "Má»¥c tiÃªu Â· Equity Â· Giá»›i háº¡n rá»§i ro Â· Hiá»‡u suáº¥t chuyÃªn sÃ¢u" },
  "system-tracker": { title: "Theo dÃµi há»‡ thá»‘ng", subtitle: "Há»“ sÆ¡ hiá»‡u suáº¥t theo nÄƒm Â· Tá»± cáº­p nháº­t tá»« 2026 vá» sau" },
  valuation: { title: "Äá»‹nh giÃ¡ doanh nghiá»‡p", subtitle: "9 mÃ´ hÃ¬nh Â· Kiá»ƒm tra chÃ©o Â· Ká»³ vá»ng thá»‹ trÆ°á»ng Â· XÃ¡c suáº¥t" },
  pair: { title: "Hiá»‡u suáº¥t sáº£n pháº©m", subtitle: "Sáº£n pháº©m nÃ o Ä‘ang táº¡o ra lá»£i tháº¿?" },
  setup: { title: "Hiá»‡u suáº¥t setup", subtitle: "Äo cháº¥t lÆ°á»£ng tá»«ng mÃ´ hÃ¬nh giao dá»‹ch" },
  weekday: { title: "Hiá»‡u suáº¥t theo thá»©", subtitle: "Chá»n Ä‘Ãºng ngÃ y Ä‘á»ƒ táº­p trung" },
  heatmap: { title: "Báº£n Ä‘á»“ nhiá»‡t", subtitle: "Máº­t Ä‘á»™ vÃ  hiá»‡u suáº¥t theo ngÃ y trong tuáº§n" },
  process: { title: "Quy trÃ¬nh setup", subtitle: "Chuáº©n hÃ³a quyáº¿t Ä‘á»‹nh trÆ°á»›c, trong vÃ  sau giao dá»‹ch" },
  notes: { title: "Ghi chÃº & review", subtitle: "Ghi sá»± tháº­t, Ä‘Ã¡nh giÃ¡ quy trÃ¬nh vÃ  chá»‘t hÃ nh Ä‘á»™ng cáº£i thiá»‡n" },
  connections: { title: "Káº¿t ná»‘i broker", subtitle: "Há»£p nháº¥t dá»¯ liá»‡u tá»« sÃ n vÃ  ná»n táº£ng giao dá»‹ch" },
  settings: { title: "CÃ i Ä‘áº·t", subtitle: "CÃ¡ nhÃ¢n hÃ³a nháº­t kÃ½ giao dá»‹ch" },
};

const NOTE_TEMPLATES = [
  {
    id: "daily-plan",
    code: "01",
    label: "Káº¿ hoáº¡ch ngÃ y",
    description: "Bá»‘i cáº£nh, ká»‹ch báº£n vÃ  giá»›i háº¡n rá»§i ro trÆ°á»›c phiÃªn.",
    content: `Káº¾ HOáº CH GIAO Dá»ŠCH â€” [NgÃ y]

1. Bá»I Cáº¢NH KHÃCH QUAN
- Tráº¡ng thÃ¡i thá»‹ trÆ°á»ng (xu hÆ°á»›ng / Ä‘i ngang / biáº¿n Ä‘á»™ng cao):
- VÃ¹ng giÃ¡ vÃ  má»‘c thá»i gian quan trá»ng:
- Tin tá»©c hoáº·c sá»± kiá»‡n cáº§n trÃ¡nh:

2. Ká»ŠCH Báº¢N GIAO Dá»ŠCH
- Ká»‹ch báº£n Æ°u tiÃªn:
- Äiá»u kiá»‡n kÃ­ch hoáº¡t setup:
- Äiá»ƒm lÃ m luáº­n Ä‘iá»ƒm máº¥t hiá»‡u lá»±c:
- Ká»‹ch báº£n thay tháº¿ / Ä‘iá»u kiá»‡n Ä‘á»©ng ngoÃ i:

3. Káº¾ HOáº CH Rá»¦I RO
- Rá»§i ro tá»‘i Ä‘a má»—i lá»‡nh: ___%
- Má»©c dá»«ng trong ngÃ y: ___R
- Sá»‘ lá»‡nh tá»‘i Ä‘a: ___

4. CAM Káº¾T THá»°C THI
- TÃ´i chá»‰ vÃ o lá»‡nh khi Ä‘á»§ Ä‘iá»u kiá»‡n A+.
- TÃ´i khÃ´ng Ä‘uá»•i giÃ¡, ná»›i SL hoáº·c tráº£ thÃ¹ thá»‹ trÆ°á»ng.`,
  },
  {
    id: "trade-review",
    code: "02",
    label: "Review má»™t lá»‡nh",
    description: "ÄÃ¡nh giÃ¡ cháº¥t lÆ°á»£ng quyáº¿t Ä‘á»‹nh, khÃ´ng chá»‰ nhÃ¬n P&L.",
    content: `REVIEW GIAO Dá»ŠCH â€” [MÃ£ / NgÃ y / PhiÃªn]

1. Sá»° THáº¬T
- Setup vÃ  khung thá»i gian:
- Entry / SL / TP / káº¿t quáº£ (R vÃ  sá»‘ tiá»n):
- áº¢nh trÆ°á»›c lá»‡nh / sau lá»‡nh:

2. LUáº¬N ÄIá»‚M BAN Äáº¦U
- Lá»£i tháº¿ Ä‘Æ°á»£c ká»³ vá»ng:
- TÃ­n hiá»‡u kÃ­ch hoáº¡t:
- Äiá»u kiá»‡n lÃ m setup máº¥t hiá»‡u lá»±c:

3. CHáº¤T LÆ¯á»¢NG THá»°C THI
- ÄÃºng setup: CÃ³ / KhÃ´ng
- ÄÃºng khá»‘i lÆ°á»£ng vÃ  rá»§i ro: CÃ³ / KhÃ´ng
- TuÃ¢n thá»§ káº¿ hoáº¡ch quáº£n lÃ½ lá»‡nh: CÃ³ / KhÃ´ng
- Tráº¡ng thÃ¡i tÃ¢m lÃ½ (trÆ°á»›c / trong / sau):

4. Káº¾T LUáº¬N
- Äiá»u Ä‘Ã£ lÃ m Ä‘Ãºng:
- Sai lá»‡ch so vá»›i káº¿ hoáº¡ch:
- Má»™t bÃ i há»c cÃ³ thá»ƒ kiá»ƒm chá»©ng:
- Má»™t hÃ nh Ä‘á»™ng cá»¥ thá»ƒ cho lá»‡nh tiáº¿p theo:`,
  },
  {
    id: "weekly-review",
    code: "03ãNµæÚ$z{-®éÜj×¢¶G&gD†5&–6UÆâbbG&gEÆææVE'"ÓÒçVÆÂÂ$VçG'’+r4Â+rEº7Î¸r%ÒÀ¢¶G&gBç67&VVç6†÷BÇÂG&gD–ÖvW2æÆVæwF‚âÂ.ª&æ‚G,k¹¶2ò6RÎ¸væ‚%ÒÀ¢´&ööÆVâ†G&gBææ÷FRçG&–Ò‚’’Â%&Wf–Wr<;2Œ:æ‚I¹–ær%ÒÀ¢ÒæÖ‚…¶FöæRÂÆ&VÅÒ’ÓâÆF—b6Æ74æÖS×¶FöæRò&FöæR"¢"'Ò¶W“×µ7G&–ær†Æ&VÂ—ÓãÆ“ç¶FöæRò.)É2"¢,+r'ÓÂö“ãÇ7ãç¶Æ&VÇÓÂ÷7ããÂöF—câ—ÓÂöF—cà¢ÆF—b6Æ74æÖSÒ'G&FR×7VÖÖ'’×&–æ6—ÆR#ãÅ6†–VÆD6†V6²6—¦S×³gÒóãÇãÇ7ãääuUœ8¤âNªä3Â÷7ããÇ7G&öæsä6ªWBÌkº6ær¹2<jVâG.¸ÖærŒjâf¸v2>¹Ì:ÒI«—¾«÷B^ª2ãÂ÷7G&öæsãÂ÷ãÂöF—cà¢Âö6–FSà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&ÖöFÂÖ7F–öç2&öfW76–öæÂÖÖöFÂÖ7F–öç2#ãÆF—cãÇ7â6Æ74æÖS×¶G&gE&VG’ò'&VG’"¢"'ÓãÆ’óç¶G&gE&VG’ò%>«Vâ<:ærÌkR"¢$<;&âF†«÷RG,k¹Öær.ª÷B'^¹–2'ÓÂ÷7ããÇ6ÖÆÃç¶G&gD6ö×ÆWFVæW77ÒRI¹’†ü:âF†¸vâ¹2<jÂ÷6ÖÆÃãÂöF—cãÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ&v†÷7BÖ'WGFöâ"öä6Æ–6³×²‚’Óâ²6WDÖöFÄ÷Vâ†fÇ6R“²6WDVF—F–æuG&FT–B†çVÆÂ“²×Óäºw“Âö'WGFöããÆ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖSÒ&vöÆBÖ'WGFöâ6ö×7B#ç¶VF—F–æuG&FT–Bò$ÌkRF†’I¹V’"¢$ÌkRv–òN¸¶6‚'ÓÂö'WGFöããÂöF—cà¢Âöf÷&ÓãÂöF—cçĞ¢¶6öææV7E&÷f–FW"bbÆF—b6Æ74æÖSÒ&ÖöFÂÖ÷fW&Æ’"&öÆSÒ'&W6VçFF–öâ"öäÖ÷W6TF÷vã×²†WfVçB’Óâ²–b†WfVçBçF&vWBÓÓÒWfVçBæ7W'&VçEF&vWB’²6WD6öææV7E&÷f–FW"†çVÆÂ“²6WEvV&†ööµFö¶Vâ‚""“²Ò×ÓãÆf÷&Ò6Æ74æÖSÒ&6öææV7F–öâÖÖöFÂ"&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&6öææV7F–öâÖF–Æör×F—FÆR"öå7V&Ö—C×·6fT6öææV7F–öçÓàĞ¢ÆF—b6Æ74æÖSÒ&ÖöFÂÖ†VB#ãÆF—cãÇ7â6Æ74æÖSÒ&W–V'&÷r#ä%$ô´U"4ôääT5D”ôãÂ÷7ããÆƒ"–CÒ&6öææV7F–öâÖF–Æör×F—FÆR#ç´%$ô´U%2æf–æB‚†'&ö¶W"’Óâ'&ö¶W"ç&÷f–FW"ÓÓÒ6öææV7E&÷f–FW"“òææÖWÓÂöƒ#ãÇç´%$ô´U%2æf–æB‚†'&ö¶W"’Óâ'&ö¶W"ç&÷f–FW"ÓÓÒ6öææV7E&÷f–FW"“òæÖöFWÓÂ÷ãÂöF—cãÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ&ÖöFÂÖ6Æ÷6R"öä6Æ–6³×²‚’Óâ²6WD6öææV7E&÷f–FW"†çVÆÂ“²6WEvV&†ööµFö¶Vâ‚""“²×Ò&–ÖÆ&VÃÒ,I;6ær#ì9sÂö'WGFöããÂöF—càĞ¢¶6öææV7E&÷f–FW"ÓÓÒ'vV&†öö²"òÆF—b6Æ74æÖSÒ&6öææV7F–öâÖ&öG’#àĞ¢·vV&†ööµFö¶VâòÃàĞ¢ÆF—b6Æ74æÖSÒ&6öææV7F–öâÖæ÷F–6RÖ&W"#ãÄ¶W•&÷VæB6—¦S×³‡ÒóãÆF—cãÇ7G&öæsäÌkRFö¶Vâæv’(	B6¸’†¸6âF¸²Ş¹—BÎªvãÂ÷7G&öæsãÇäî«÷RŞªWBFö¶VâÂŒ:7’NªòFö¶VâŞ¹¶“²Fö¶Vâ<Z’>«Òæ~º¶ær†şªBI¹–ærãÂ÷ãÂöF—cãÂöF—càĞ¢ÆF—b6Æ74æÖSÒ'vV&†öö²×Fö¶VâÖ&÷‚#ãÇ7ãä$T$U"Dô´TãÂ÷7ããÆ6öFSç·vV&†ööµFö¶VçÓÂö6öFSãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâfö–B6÷•vV&†ööµFö¶Vâ‚—ÓãÄ6÷’6—¦S×³WÒóâ6ò6Œ:—Fö¶VãÂö'WGFöããÂöF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&6öFRÖÆ&VÂ#äVæGö–çBæªÖâÎ¸væƒÇ&Såõ5BµtT$„ôôµôTäEô”åGÓÂ÷&SãÂöÆ&VÃàĞ¢Ç6Æ74æÖSÒ&6öææV7F–öâÖ†VÇ#ä'&–FvR~ºÖ’†VFW"Æ#äWF†÷&—¦F–öã¢&V&W"Dô´TãÂö#ââŞ¹v’Î¸væ‚>ªvâW‡FW&æÄ–BÂÖ&¶WBl:7–Ö&öÃ²¸rF¹ær6¹æræª×G,;–ærF†VòÜ:2Î¸væ‚ãÂ÷àĞ¢Âóâ¢ÃàĞ¢ÆF—b6Æ74æÖSÒ&6öææV7F–öâÖæ÷F–6R#ãÄ¶W•&÷VæB6—¦S×³‡ÒóãÆF—cãÇ7G&öæsäŞ¹—BFö¶Vâ&œ:¦ær6†ò'&–FvRv–òN¸¶6ƒÂ÷7G&öæsãÇåFö¶Vâ6¸’L;–ærI¸2v†’Î¸væ‚l:ò¦÷W&æÂÂ¶Œ;Fær<;2W¸âI¸Ö2NºòÆ¸wR†ş«v2I«wBÎ¸væ‚'&ö¶W"ãÂ÷ãÂöF—cãÂöF—càĞ¢ÆÆ&VÃåL:¦â¾«÷Bî¹“Æ–çWBfÇVS×¶6öææV7F–öäG&gBæÆ&VÇÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂÆ&VÃ¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò%l:ÒNºS¢'&–FvR'&ö¶W"&œ:¦ær"&WV—&VBóãÂöÆ&VÃàĞ¢ÆF—b6Æ74æÖSÒ'vV&†öö²ÖfÆ÷r#ãÆF—cãÆ#ä'&ö¶W"ò<:ãÂö#ãÇ7ãä¶¹·†ş«v2I;6ærÎ¸væƒÂ÷7ããÂöF—cãÆ“î(i#Âö“ãÆF—cãÆ#ä'&–FvSÂö#ãÇ7ãä6‡^ª–âŒ;6¥4ôãÂ÷7ããÂöF—cãÆ“î(i#Âö“ãÆF—cãÆ#ä¦÷W&æÃÂö#ãÇ7ãåN»6¹ærG,;–æsÂ÷7ããÂöF—cãÂöF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&6öFRÖÆ&VÂ#äŞª·R–ÆöCÇ&Sç¶°Ğ¢&W‡FW&æÄ–B#¢&FVÂÓ#3CSb"ÀĞ¢&Ö&¶WB#¢$f÷&W‚"ÀĞ¢'7–Ö&öÂ#¢$UU%U4B"ÀĞ¢'6–FR#¢$%U’"ÀĞ¢&6Æ÷6VDB#¢###bÓ‚Ó…C“£3£¢"ÀĞ¢'æÂ#¢#SÀĞ¢&fVW2#¢CSÀĞ¢'VçF—G’#¢ã"ÀĞ¢&VçG'•&–6R#¢ãc#RÀĞ¢&W†—E&–6R#¢ãcCĞ§ÖÓÂ÷&SãÂöÆ&VÃàĞ¢Ç6Æ74æÖSÒ&6öææV7F–öâÖ†VÇ#äÖ&¶WBæªÖã¢6º–ær¶†ü:âÂf÷&W‚Â7'—Fòl:Œ:ærŒ;6â<;2F¸2~ºÖ’Ş¹—BÎ¸væ‚ÂŞ¹—BŞª6ær†ş«v2¶²'G&FW2#¢²ââå×ÖÒN¹’ISÎ¸væ‚öÎªvâãÂ÷àĞ¢ÂóçĞĞ¢ÂöF—câ¢—4'&–FvU&÷f–FW"†6öææV7E&÷f–FW"’òÆF—b6Æ74æÖSÒ&6öææV7F–öâÖ&öG’#àĞ¢·vV&†ööµFö¶VâòÃàĞ¢ÆF—b6Æ74æÖSÒ&6öææV7F–öâÖæ÷F–6RÖ&W"#ãÄ¶W•&÷VæB6—¦S×³‡ÒóãÆF—cãÇ7G&öæsäÌkRFö¶Vâ´%$”DtUôDUD”Å5¶6öææV7E&÷f–FW%Òç6÷W&6WÒæv“Â÷7G&öæsãÇåFö¶Vâ6¸’†¸6âF¸²Îªvâì:’âNªòFö¶VâŞ¹¶’>«Òl;B†¸wRFö¶Vâ<Z’ãÂ÷ãÂöF—cãÂöF—càĞ¢ÆF—b6Æ74æÖSÒ'vV&†öö²×Fö¶VâÖ&÷‚#ãÇ7ãä$T$U"Dô´TãÂ÷7ããÆ6öFSç·vV&†ööµFö¶VçÓÂö6öFSãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâfö–B6÷•vV&†ööµFö¶Vâ‚—ÓãÄ6÷’6—¦S×³WÒóâ6ò6Œ:—Fö¶VãÂö'WGFöããÂöF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&6öFRÖÆ&VÂ#äVæGö–çBW6‚#BósÇ&Såõ5BµtT$„ôôµôTäEô”åGÓÂ÷&SãÂöÆ&VÃàĞ¢Ç6Æ74æÖSÒ&6öææV7F–öâÖ†VÇ#ä~ºÖ’†VFW"Æ#äWF†÷&—¦F–öã¢&V&W"Dô´TãÂö#âân¹¶’´%$”DtUôDUD”Å5¶6öææV7E&÷f–FW%Òç6÷W&6WÒÂÖ&¶WBŞ«v2I¸¶æ‚Ì:Æ#ç´%$”DtUôDUD”Å5¶6öææV7E&÷f–FW%ÒæÖ&¶WGÓÂö#ã²6¸’>ªvâW‡FW&æÄ–Bl:7–Ö&öÂI¸2I¸¶æ‚Fæ‚Î¸væ‚ãÂ÷àĞ¢Âóâ¢ÃàĞ¢ÆF—b6Æ74æÖSÒ&6öææV7F–öâÖæ÷F–6R#ãÅ6†–VÆD6†V6²6—¦S×³‡ÒóãÆF—cãÇ7G&öæsä'&–FvRL:6‚&¸wB¶¸ö’L:’¶†şª6âv–òN¸¶6ƒÂ÷7G&öæsãÇç´%$”DtUôDUD”Å5¶6öææV7E&÷f–FW%Òææ÷F–6WÓÂ÷ãÂöF—cãÂöF—càĞ¢ÆÆ&VÃåL:¦â¾«÷Bî¹“Æ–çWBfÇVS×¶6öææV7F–öäG&gBæÆ&VÇÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂÆ&VÃ¢RçF&vWBçfÇVRÒ—Ò&WV—&VBóãÂöÆ&VÃàĞ¢ÆF—b6Æ74æÖSÒ'7–æ2ÖÖöFRÖ÷F–öç2"&öÆSÒ&w&÷W"&–ÖÆ&VÃÒ$6¸Öâ6«òI¹’I¹6ær.¹’#àĞ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶6öææV7F–öäG&gBæ66÷VçEG—RÓÓÒ'W6‚"ò&7F—fR"¢"'Òöä6Æ–6³×²‚’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ66÷VçEG—S¢'W6‚"Ò—ÓãÇ7G&öæsåW6‚#BósÂ÷7G&öæsãÇ7ãä¶‡Wœ:¦âL;–ær+r'&–FvR6ºrI¹–ær~ºÖ“Â÷7ããÂö'WGFöãàĞ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶6öææV7F–öäG&gBæ66÷VçEG—RÓÓÒ'VÆÂ"ò&7F—fR"¢"'Òöä6Æ–6³×²‚’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ66÷VçEG—S¢'VÆÂ"Ò—ÓãÇ7G&öæsåVÆÂ'&–FvSÂ÷7G&öæsãÇ7ãåŒ:2F»2U$ÂG,k¹¶2¶†’ÌkR+rŞ¹v’RŒ;§CÂ÷7ããÂö'WGFöãà¢ÂöF—càĞ¢¶6öææV7F–öäG&gBæ66÷VçEG—RÓÓÒ'W6‚"òÃàĞ¢´%$”DtUôDUD”Å5¶6öææV7E&÷f–FW%Òæf÷&V–vä7W'&Væ7’bbÆÆ&VÃåN»rvœ:F¸âL:’¶†şª6â(i"dìIÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"fÇVS×¶6öææV7F–öäG&gBæg…&FWÒöäfö7W3×·6VÆV7DçVÖW&–4–çWGÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂg…&FS¢æ÷&ÖÆ—¦TçVÖW&–4–çWB†RçF&vWBçfÇVR’Ò—ÒóãÇ6ÖÆÃåôÂÂ&—6²l:Œ:ÒNº²'&–FvR>«ÒIkº62æŒ:&ân¹¶’N»rvœ:ì:’ãÂ÷6ÖÆÃãÂöÆ&VÃçĞĞ¢ÆF—b6Æ74æÖSÒ'vV&†öö²ÖfÆ÷r#ãÆF—cãÆ#ç´%$”DtUôDUD”Å5¶6öææV7E&÷f–FW%Òç6÷W&6WÓÂö#ãÇ7ãäÎ¸væ‚I:2¶¹·üI;6æsÂ÷7ããÂöF—cãÆ“î(i#Âö“ãÆF—cãÆ#ä'&–FvR#BósÂö#ãÇ7ãä~ºÖ’¥4ôâ.ª6òŞª×CÂ÷7ããÂöF—cãÆ“î(i#Âö“ãÆF—cãÆ#ä¦÷W&æÃÂö#ãÇ7ãä6¹ærG,;–ærN»I¹–æsÂ÷7ããÂöF—cãÂöF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&6öFRÖÆ&VÂ#å–ÆöBN¹’F†¸7RŞ¹ò.¹–æsÇ&Sç¶'&–FvU–ÆöDW†×ÆR†6öææV7E&÷f–FW"—ÓÂ÷&SãÂöÆ&VÃàĞ¢Ç6Æ74æÖSÒ&6öææV7F–öâÖ†VÇ#å6R¶†’ÌkRÂ>ªWŞ¹—BFö¶Vâv†’NºòÆ¸wR&œ:¦ærâ'&–FvR<;2F¸2~ºÖ’Ş¹—Bö&¦V7BÂŞ¹—BŞª6ær†ş«v2¶²'G&FW2#¢²ââå×ÖÒN¹’ISÎ¸væ‚öÎªvâãÂ÷àĞ¢Âóâ¢ÃàĞ¢ÆF—b6Æ74æÖSÒ&f÷&ÒÖw&–BGvò#ãÆÆ&VÃä'&–FvR…EE3Æ–çWBG—SÒ'W&Â"fÇVS×¶6öææV7F–öäG&gBæ'&–FvUW&ÇÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ'&–FvUW&Ã¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò&‡GG3¢òö'&–FvRÖ7VÖ&âæW†×ÆR÷G&FW2"&WV—&VBóãÂöÆ&VÃãÆÆ&VÃä'&–FvRFö¶VãÆ–çWBG—SÒ'77v÷&B"WFô6ö×ÆWFSÒ&æWr×77v÷&B"fÇVS×¶6öææV7F–öäG&gBæ'&–FvUFö¶VçÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ'&–FvUFö¶Vã¢RçF&vWBçfÇVRÒ—Ò&WV—&VBóãÂöÆ&VÃãÂöF—càĞ¢´%$”DtUôDUD”Å5¶6öææV7E&÷f–FW%Òæf÷&V–vä7W'&Væ7’bbÆÆ&VÃåN»rvœ:F¸âL:’¶†şª6â(i"dìIÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"fÇVS×¶6öææV7F–öäG&gBæg…&FWÒöäfö7W3×·6VÆV7DçVÖW&–4–çWGÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂg…&FS¢æ÷&ÖÆ—¦TçVÖW&–4–çWB†RçF&vWBçfÇVR’Ò—ÒóãÇ6ÖÆÃåôÂÂ&—6²l:Œ:ÒNº²'&–FvR>«ÒIkº62æŒ:&ân¹¶’N»rvœ:ì:’ãÂ÷6ÖÆÃãÂöÆ&VÃçĞĞ¢ÆÆ&VÂ6Æ74æÖSÒ&6öFRÖÆ&VÂ#å&W7öç6R'&–FvRIkº626ªWæªÖãÇ&Sç¶·²ââçG&FRÕĞĞ¦†ş«v0Ğ§²'G&FW2#¢·²ââçG&FRÕÒÖÓÂ÷&SãÂöÆ&VÃàĞ¢Ç6Æ74æÖSÒ&6öææV7F–öâÖ†VÇ#ä¦÷W&æÂ~¸Ö’VæGö–çB…EE2n¹¶’†VFW"&V&W"ÂæªÖâN¹’IãÎ¸væ‚öÎªvâl:N»6¹ærG,;–ær.«ærW‡FW&æÄ–BãÂ÷àĞ¢ÂóçĞĞ¢ÂóçĞĞ¢ÂöF—câ¢6öææV7E&÷f–FW"ÓÓÒ'G&F–æwf–Wr"òÆF—b6Æ74æÖSÒ&6öææV7F–öâÖ&öG’#ãÆF—b6Æ74æÖSÒ&6öææV7F–öâÖæ÷F–6RÖ&W"#ãÇ7ãâÂ÷7ããÆF—cãÇ7G&öæsåG&F–æuf–Wr~ºÖ’ÆW'B.«ærvV&†öö³Â÷7G&öæsãÇäL;–ærWFò–×÷'B‡V"Ì:ÒVæGö–çB.ª6òŞª×Bâ¶Œ;FærIkŞª×B¶ª—R'&ö¶W"l:òî¹–’GVærÆW'BãÂ÷ãÂöF—cãÂöF—cãÆF—b6Æ74æÖSÒ'vV&†öö²ÖfÆ÷r#ãÆF—cãÆ#åG&F–æuf–WsÂö#ãÇ7ãäÆW'B¥4ôãÂ÷7ããÂöF—cãÆ“î(i#Âö“ãÆF—cãÆ#ä'&–FvSÂö#ãÇ7ãävŒ:—¾«÷B^ª2Î¸væƒÂ÷7ããÂöF—cãÆ“î(i#Âö“ãÆF—cãÆ#åGVâG&FW#Âö#ãÇ7ãä~ªöâl:ò¦÷W&æÃÂ÷7ããÂöF—cãÂöF—cãÆÆ&VÂ6Æ74æÖSÒ&6öFRÖÆ&VÂ#äŞª·R¥4ôâÆW'CÇ&Sç¶°Ğ¢'7–Ö&öÂ#¢'··F–6¶W'×Ò"ÀĞ¢'6–FR#¢$%U’"ÀĞ¢'&–6R#¢'·¶6Æ÷6W×Ò"ÀĞ¢'F–ÖR#¢'··F–ÖVæ÷w×Ò"ÀĞ¢&Ö&¶WB#¢$7'—Fò Ğ§ÖÓÂ÷&SãÂöÆ&VÃãÇ6Æ74æÖSÒ&6öææV7F–öâÖ†VÇ#äÆW'BÌ:L:Öâ†¸wS²¾«÷B^ª2ôÂì:¦âÎªW’Nº²W†V7WF–öâ>ºv&–ææ6RÂ'–&—BÂÕCR†ş«v2'&–FvR'&ö¶W"I¸2G,:æ‚v†’æªÖâ6’ãÂ÷ãÂöF—câ¢6öææV7E&÷f–FW"ÓÓÒ'fâÖ'&ö¶W""òÆF—b6Æ74æÖSÒ&6öææV7F–öâÖ&öG’#ãÆF—b6Æ74æÖSÒ&6öææV7F–öâÖæ÷F–6R#ãÇ7ãä55cÂ÷7ããÆF—cãÇ7G&öæsìI¸¶æ‚NªærIkº62æªÖâN»I¹–æsÂ÷7G&öæsãÇäL;"<:2>¹—BLkjærIkjæs¢æ|:’ÂÜ:2Â×Vö,:âÂ¶¹’Ìkº6ærÂvœ:ÂŒ:Òl:Ì:6’öÎ¹rãÂ÷ãÂöF—cãÂöF—cãÆÆ&VÃä'&ö¶W#Ç6VÆV7BfÇVS×¶6öææV7F–öäG&gBæ'&ö¶W$æÖWÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ'&ö¶W$æÖS¢RçF&vWBçfÇVRÒ—ÓãÆ÷F–öãåe3Âö÷F–öããÆ÷F–öãå54“Âö÷F–öããÆ÷F–öãåD4%3Âö÷F–öããÆ÷F–öãådäD•$T5CÂö÷F–öããÆ÷F–öãäÔ%3Âö÷F–öããÆ÷F–öãä…43Âö÷F–öããÆ÷F–öãä'&ö¶W"dãÂö÷F–öããÂ÷6VÆV7CãÂöÆ&VÃãÆÆ&VÂ6Æ74æÖSÒ&vöÆBÖ'WGFöâ6ö×7Bf–ÆRÖ'WGFöâÆ&vR#ä6¸Öâf–ÆR55cÆ–çWBG—SÒ&f–ÆR"66WCÒ"æ77bÂçG‡BÇFW‡Bö77b"×VÇF—ÆRFFÖÖ&¶WCÒ$6º–ær¶†ü:â"FFÖ'&ö¶W#×¶6öææV7F–öäG&gBæ'&ö¶W$æÖWÒöä6†ævS×²†WfVçB’Óâ²fö–B–×÷'D77b†WfVçB“²6WD6öææV7E&÷f–FW"†çVÆÂ“²×ÒóãÂöÆ&VÃãÂöF—câ¢ÆF—b6Æ74æÖSÒ&6öææV7F–öâÖ&öG’#àĞ¢ÆF—b6Æ74æÖSÒ&6öææV7F–öâÖæ÷F–6R#ãÇ7ãî)xsÂ÷7ããÆF—cãÇ7G&öæsåŒ:2F»2G.»2F«÷n¹¶’<:ãÂ÷7G&öæsãÇä6¸’L;–ær¶Œ;6&VBÔöæÇ“²Nª÷BG&FRl:v—F†G&râ¸rF¹ær¶¸6ÒG&¶Œ;6Fª×BG,k¹¶2¶†’ÌkRl:Ü:2Œ;66V7&WB.«ærU2Ôt4ÒãÂ÷ãÂöF—cãÂöF—cà¢ÆF—b6Æ74æÖSÒ&f÷&ÒÖw&–BGvò#ãÆÆ&VÃåL:¦â¾«÷Bî¹“Æ–çWBfÇVS×¶6öææV7F–öäG&gBæÆ&VÇÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂÆ&VÃ¢RçF&vWBçfÇVRÒ—Ò&WV—&VBóãÂöÆ&VÃãÆÆ&VÃäÆşª’L:’¶†şª6ãÇ6VÆV7BfÇVS×¶6öææV7F–öäG&gBæ66÷VçEG—WÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ66÷VçEG—S¢RçF&vWBçfÇVRÒ—ÓãÆ÷F–öâfÇVS×¶6öææV7E&÷f–FW"ÓÓÒ&'–&—B"ò&Æ–æV""¢&gWGW&W2'ÓåŒ:’6–æ‚ògWGW&W3Âö÷F–öããÆ÷F–öâfÇVSÒ'7÷B#å7÷CÂö÷F–öããÂ÷6VÆV7CãÂöÆ&VÃãÂöF—càĞ¢ÃãÆF—b6Æ74æÖSÒ&f÷&ÒÖw&–BGvò#ãÆÆ&VÃä’¶W“Æ–çWBG—SÒ'77v÷&B"WFô6ö×ÆWFSÒ&æWr×77v÷&B"fÇVS×¶6öææV7F–öäG&gBæ”¶W—Òöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ”¶W“¢RçF&vWBçfÇVRÒ—Ò&WV—&VBóãÂöÆ&VÃãÆÆ&VÃä’6V7&WCÆ–çWBG—SÒ'77v÷&B"WFô6ö×ÆWFSÒ&æWr×77v÷&B"fÇVS×¶6öææV7F–öäG&gBæ•6V7&WGÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ•6V7&WC¢RçF&vWBçfÇVRÒ—Ò&WV—&VBóãÂöÆ&VÃãÂöF—cç¶6öææV7E&÷f–FW"ÓÓÒ&&–ææ6R"bbÆÆ&VÃå7–Ö&öÇ2>ªvâI¹6ær.¹“Æ–çWBfÇVS×¶6öææV7F–öäG&gBç7–Ö&öÇ7Òöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂ7–Ö&öÇ3¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$%D5U4EBÂUD…U4EB"óãÂöÆ&VÃçÓÂóàĞ¢ÆÆ&VÃåN»rvœ:U4BõU4EB(i"dìIÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"fÇVS×¶6öææV7F–öäG&gBæg…&FWÒöäfö7W3×·6VÆV7DçVÖW&–4–çWGÒöä6†ævS×²†R’Óâ6WD6öææV7F–öäG&gB‡²ââæ6öææV7F–öäG&gBÂg…&FS¢æ÷&ÖÆ—¦TçVÖW&–4–çWB†RçF&vWBçfÇVR’Ò—ÒóãÇ6ÖÆÃäL;–ærI¸2º7æªWBôÂ7'—Fòl:f÷&W‚l:òF6†&ö&BdìIãÂ÷6ÖÆÃãÂöÆ&VÃàĞ¢ÂöF—cçĞĞ¢ÆF—b6Æ74æÖSÒ&ÖöFÂÖ7F–öç2#ãÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ&v†÷7BÖ'WGFöâ"F—6&ÆVC×·6f–æt6öææV7F–öçÒöä6Æ–6³×²‚’Óâ²6WD6öææV7E&÷f–FW"†çVÆÂ“²6WEvV&†ööµFö¶Vâ‚""“²×Óç·vV&†ööµFö¶Vâò,I;6ær"¢$ºw’'ÓÂö'WGFöãç¶6öææV7E&÷f–FW"ÓÓÒ'G&F–æwf–Wr"òÆ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖSÒ&vöÆBÖ'WGFöâ6ö×7B#ìI:2†¸7SÂö'WGFöãâ¢6öææV7E&÷f–FW"ÓÓÒ'vV&†öö²"ÇÂ†—4'&–FvU&÷f–FW"†6öææV7E&÷f–FW"’bb6öææV7F–öäG&gBæ66÷VçEG—RÓÓÒ'W6‚"’òvV&†ööµFö¶VâòÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ&vöÆBÖ'WGFöâ6ö×7B"öä6Æ–6³×²‚’Óâ²6WD6öææV7E&÷f–FW"†çVÆÂ“²6WEvV&†ööµFö¶Vâ‚""“²×ÓìI:2ÌkRFö¶VãÂö'WGFöãâ¢Æ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖSÒ&vöÆBÖ'WGFöâ6ö×7B"F—6&ÆVC×·6f–æt6öææV7F–öçÓç·6f–æt6öææV7F–öâò,IærNªş(
b"¢6öææV7E&÷f–FW"ÓÓÒ'vV&†öö²"ò%Nªò¶Œ;6.ª6òŞª×B"¢%Nªò¾«÷Bî¹’bFö¶Vâ'ÓÂö'WGFöãâ¢6öææV7E&÷f–FW"ÓÒ'fâÖ'&ö¶W""bbÆ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖSÒ&vöÆBÖ'WGFöâ6ö×7B"F—6&ÆVC×·6f–æt6öææV7F–öçÓç·6f–æt6öææV7F–öâò,IærŒ:2F»>(
b"¢D•$T5Eô•õ$õd”DU%2æ–æ6ÇVFW2†6öææV7E&÷f–FW"’ò%Œ:2F»2b¾«÷Bî¹’"¢$¶¸6ÒG&b¾«÷Bî¹’'ÓÂö'WGFöãçÓÂöF—cà¢Âöf÷&ÓãÂöF—cçĞĞ¢¶7F—fT–ÖvRbbÆF—b6Æ74æÖSÒ&–ÖvR×f–WvW"Ö÷fW&Æ’"&öÆSÒ'&W6VçFF–öâ"öäÖ÷W6TF÷vã×²†WfVçB’Óâ²–b†WfVçBçF&vWBÓÓÒWfVçBæ7W'&VçEF&vWB’6WD7F—fT–ÖvR†çVÆÂ“²×ÓãÇ6V7F–öâ6Æ74æÖSÒ&–ÖvR×f–WvW""&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&–ÖvR×f–WvW"×F—FÆR#ãÆ†VFW#ãÆF—cãÇ7â6Æ74æÖSÒ&W–V'&÷r#îª$ä‚t”òN¸¤4ƒÂ÷7ããÆƒ"–CÒ&–ÖvR×f–WvW"×F—FÆR#ç¶7F—fT–ÖvUG&FSòç7–Ö&öÂóò$&¸7RI¹2'Ò+r¶7F—fT–ÖvUG&FSòç6–FRóò"'ÓÂöƒ#ãÇç¶7F—fT–ÖvUG&FRòDDRæf÷&ÖB†æWrFFR†G¶7F—fT–ÖvUG&FRæFFWÕC#££’’¢"'Ò+r¶7F—fT–ÖvRæf–ÆVæÖWÓÂ÷ãÂöF—cãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ6WD7F—fT–ÖvR†çVÆÂ—Ò&–ÖÆ&VÃÒ,I;6ærª6æ‚#ì9sÂö'WGFöããÂö†VFW#ãÆF—b6Æ74æÖSÒ&–ÖvR×f–WvW"×7FvR#ãÆ–Ör7&3×¶7F—fT–ÖvRçW&ÇÒÇC×¶&¸7RI¹2G¶7F—fT–ÖvUG&FSòç7–Ö&öÂóò&v–òN¸¶6‚'ÖÒóãÂöF—cç¶7F—fT–ÖvU6–&Æ–æw2æÆVæwF‚âbbÆF—b6Æ74æÖSÒ&–ÖvR×f–WvW"×F‡VÖ'2#ç¶7F—fT–ÖvU6–&Æ–æw2æÖ‚†–ÖvR’ÓâÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶–ÖvRæ–BÓÓÒ7F—fT–ÖvRæ–Bò&7F—fR"¢"'Ò¶W“×¶–ÖvRæ–GÒöä6Æ–6³×²‚’Óâ6WD7F—fT–ÖvR†–ÖvR—ÓãÆ–Ör7&3×¶–ÖvRçW&ÇÒÇC×¶–ÖvRæf–ÆVæÖWÒóãÂö'WGFöãâ—ÓÂöF—cçÓÆfö÷FW#ãÇ7ãç²†7F—fT–ÖvRç6—¦T'—FW2ò#Bò#B’çFôf—†VBƒ—ÒÔ"+rÌkR&œ:¦ærLkÂ÷7ããÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ&–ÖvRÖFVÆWFRÖ'WGFöâ"öä6Æ–6³×²‚’Óâfö–BFVÆWFUG&FT–ÖvR†7F—fT–ÖvR—ÓãÅG&6ƒ"6—¦S×³WÒóâŒ;6ª6æƒÂö'WGFöããÂöfö÷FW#ãÂ÷6V7F–öããÂöF—cçĞĞ¢·Fö7BbbÆF—b6Æ74æÖSÒ'Fö7B"&öÆSÒ'7FGW2#ãÇ7ãî)É3Â÷7ãç·Fö7GÓÂöF—cçĞĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ 