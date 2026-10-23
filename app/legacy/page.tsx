"use client";
import { useEffect, useState } from 'react';
import { BarChart3, BookOpen, Building2, CalendarDays, Database, Gauge, History, LayoutDashboard, ListChecks, Menu, NotebookPen, Plus, PlugZap, Settings, ShieldCheck, type LucideIcon } from 'lucide-react';
import DataConnections from '../components/DataConnections';
import { LedgerProvider, useLedger } from '../components/LedgerContext';
import LedgerPages, { LedgerFilters } from '../components/LedgerPages';
import { ClassicOverview, AnalysisModes } from '../components/ClassicViews';
import ManualTrade from '../components/ManualTrade';
import CompanyValuation from '../components/CompanyValuation';
import { readLegacySource } from '../../lib/trading/storage/legacySource';
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
  connections: { title: "Kết nối dữ liệu", subtitle: "Hợp nhất dữ liệu từ sàn và nền tảng giao dịch" },
  settings: { title: "Cài đặt", subtitle: "Cá nhân hóa nhật ký giao dịch" },
};

export default function Home() { return <LedgerProvider><HomeContent /></LedgerProvider>; }
function HomeContent() {
  const ledger=useLedger();
  const [view,setView]=useState<View>('overview'),[mobileNav,setMobileNav]=useState(false),[manualOpen,setManualOpen]=useState(false);
  const [legacy,setLegacy]=useState<{trades:unknown[];isDemo:boolean}>({trades:[],isDemo:true}),[legacyError,setLegacyError]=useState('');
  useEffect(()=>{
    const sync=()=>{const requested=window.location.hash.slice(1).split('?')[0];setView(Object.hasOwn(VIEW_META,requested)?requested as View:'overview');};
    sync();window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);
    return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};
  },[]);
  useEffect(()=>{document.title=VIEW_META[view].title+' · Trading Plan Pro';},[view]);
  // Historical data is read only for the migration screen. No legacy sync or seeding.
  useEffect(()=>{
    if(view!=='settings')return;
    const abort=new AbortController();let active=true;
    void(async()=>{
      try {
        let suffix='';const session=await fetch('/api/site-session',{cache:'no-store',signal:abort.signal}).catch(()=>null);
        if(session?.ok){const s=await session.json() as {user?:{id?:unknown}} | null;if(typeof s?.user?.id==='string')suffix=':'+s.user.id;}
        const local=readLegacySource(localStorage,suffix);if(active)setLegacy(local);
        const response=await fetch('/api/trades',{cache:'no-store',signal:abort.signal});
        if(response.ok){const payload=await response.json() as {trades?:unknown} | null;if(Array.isArray(payload?.trades)&&payload.trades.length&&active)setLegacy({trades:payload.trades,isDemo:false});}
      }catch(error){if(active&&!abort.signal.aborted)setLegacyError(String(error));}
    })();return()=>{active=false;abort.abort();};
  },[view]);
  function navigate(next:View){setView(next);window.history.pushState(null,'','#'+next);setMobileNav(false);}
  const meta=VIEW_META[view],closed=ledger.derived?.result.cycles.filter(c=>!c.shadowed&&c.status==='closed').length??0;
  const demoVisible=ledger.snapshot?.data.accounts.some(a=>a.label.startsWith('MINH HỌA')&&ledger.snapshot!.data.batches.some(b=>b.accountId===a.accountId&&b.connector==='demo-30'&&b.status==='committed')&&(!ledger.filters.accountIds?.length||ledger.filters.accountIds.includes(a.accountId)));
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <aside className={`sidebar ${mobileNav?'open':''}`}>
      <div className="brand"><div className="brand-mark" aria-hidden="true"><i/><i/><i/><i/><b/></div><strong><span>Tuan</span> Trader</strong><small>KỶ LUẬT · KIÊN ĐỊNH · TĂNG TRƯỞNG</small></div>
      <nav aria-label="Điều hướng chính">{NAV_GROUPS.map(group=><section className="nav-group" aria-label={group.label} key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} aria-current={view===item.id?'page':undefined} className={view===item.id?'active':''} onClick={()=>navigate(item.id)}><Icon className="nav-icon" size={17} aria-hidden="true"/>{item.label}</button>;})}</section>)}</nav>
      <div className="sidebar-footer"><button className="gold-button" onClick={()=>setManualOpen(true)}><Plus size={17}/><span>Thêm giao dịch</span></button><div><span>{closed} lệnh</span><small>•</small><span>Sổ dữ liệu v3</span></div></div>
    </aside>
    {mobileNav&&<button className="mobile-backdrop" aria-label="Đóng menu" onClick={()=>setMobileNav(false)}/>}
    <main className="main-content" id="main-content"><header className="topbar"><button className="mobile-menu" aria-label="Mở menu" onClick={()=>setMobileNav(true)}><Menu size={18}/></button><div><h1>{meta.title}</h1><p>{meta.subtitle}</p></div><div className="top-actions"><span className="data-state-chip device"><Database size={14}/>Sổ v3 · Trên thiết bị</span><button className="quick-add" onClick={()=>setManualOpen(true)}><Plus size={16}/><span>Thêm lệnh</span></button></div></header>
      <div className="content-area">
        <section className="hub-notice" aria-label="Bản nhật ký mới">
          <strong>Nhật ký v6 · S5–S9 preview</strong>
          <p>Nhập Binance, phân tích nâng cao, mô phỏng và sao lưu mã hóa. <a href="/v6/">Mở nhật ký v6</a>. Bản v6 dùng sổ riêng trên thiết bị; dữ liệu sổ v3 không tự chuyển sang. Các công cụ cũ tiếp tục ở trang này.</p>
        </section>
        {demoVisible&&!['valuation','connections'].includes(view)&&<section className="hub-notice" role="status"><strong>DỮ LIỆU MINH HỌA</strong><p>Phạm vi hiện tại có lệnh giả lập để trải nghiệm nhật ký; không phải giao dịch hoặc thành tích thực tế. Chọn tài khoản ở bộ lọc để tách dữ liệu. Có thể hoàn tác cả đợt tại <a href="#connections?tab=history">Lịch sử nhập</a>.</p></section>}
        {!['valuation','connections'].includes(view)&&<div className="data-hub"><LedgerFilters/></div>}
        <DataConnections active={view==='connections'}/>
        {view==='valuation'?<CompanyValuation/>:view==='connections'?null:view==='overview'?<ClassicOverview onAdd={()=>setManualOpen(true)}/>:view==='statistics'||view==='system-tracker'?<AnalysisModes view={view} onOpenJournal={()=>navigate('journal')}/>:<LedgerPages view={view} legacyTrades={legacy.trades} legacyIsDemo={legacy.isDemo}/>}
        {view==='settings'&&legacyError&&<p role="alert" className="hub-error">{legacyError}</p>}
      </div>
      <footer className="app-footer"><div><span>Tuan Trader · Trading Plan Pro</span><small>Sổ v3 — dữ liệu trên thiết bị · Không phải khuyến nghị đầu tư.</small></div><nav aria-label="Thông tin website"><a href="/phuong-phap">Phương pháp</a><a href="/bao-mat">Bảo mật dữ liệu</a></nav></footer>
    </main>
    {manualOpen&&<ManualTrade close={()=>setManualOpen(false)} onSaved={accountId=>{setManualOpen(false);ledger.setFilters({timezone:ledger.filters.timezone,accountIds:[accountId],breakevenBandVND:ledger.filters.breakevenBandVND,includeEstimatedRisk:ledger.filters.includeEstimatedRisk});navigate('journal');}}/>}
  </div>;
}
