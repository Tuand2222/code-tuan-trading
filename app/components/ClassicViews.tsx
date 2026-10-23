"use client";
import {useEffect,useState,type CSSProperties} from 'react';
import {Sparkles,Plus} from 'lucide-react';
import {useLedger} from './LedgerContext';
import TradingMetrix from './TradingMetrix';
import SystemTracker from './SystemTracker';
import LedgerPages from './LedgerPages';
import EquityTimeChart from './EquityTimeChart';
import {classicReport,metricText} from '../../lib/trading/selectors/classic';
import {metricsVM} from '../../lib/trading/selectors';
import {metricRegistry} from '../../lib/trading/selectors/metricRegistry';
const MARKETS=[{id:'all',label:'Tất cả thị trường',icon:'◈'},{id:'commodity',label:'Hàng hóa',icon:'◇'},{id:'stock',label:'Chứng khoán',icon:'▥'},{id:'crypto',label:'Crypto',icon:'₿'},{id:'forex',label:'Forex',icon:'↔'}];
const money=(v:number,_compact=false)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);
export function ClassicOverview({onAdd}:{onAdd:()=>void}) {
 const {derived,filters,setFilters}=useLedger();
 if(!derived)return <p>Đang đọc sổ giao dịch…</p>;
 const metrics=derived.metrics,report=classicReport(derived.result,filters,0);
 const value=(id:string)=>metrics[id].status==='ok'?metrics[id].value:0;
 const stats={total:value('total'),wins:value('wins'),losses:value('losses'),breakeven:value('breakeven'),winRate:value('winRate'),discipline:value('discipline')};
 const winDeg=stats.total?stats.wins/stats.total*360:0,lossDeg=stats.total?stats.losses/stats.total*360:0;
 const donutStyle={'--win':winDeg+'deg','--loss':winDeg+lossDeg+'deg'} as CSSProperties;
 const marketScope=filters.markets?.length===1?filters.markets[0]:'all';
 const setMarketScope=(id:string)=>setFilters({...filters,markets:id==='all'?undefined:[id]});
 const marketRollup=MARKETS.slice(1).map(m=>{const ms=metricsVM(derived.result,{...filters,markets:[m.id]});return {...m,stats:{total:ms.total.status==='ok'?ms.total.value:0,net:ms.net.status==='ok'?ms.net.value:NaN}};});
 const daily=Array.from({length:7},(_,i)=>({label:i===6?'CN':'Thứ '+(i+2),pnl:0}));
 for(const row of report.rows){const day=(new Date(row.date+'T12:00:00Z').getUTCDay()+6)%7;daily[day].pnl+=row.pnl;}
 const maxDaily=Math.max(...daily.map(d=>Math.abs(d.pnl)),1);
 return <>        <section className="overview-hero">
          <div className="overview-hero-copy">
            <span className="product-kicker"><Sparkles size={14} /> TRADING PLAN PRO</span>
            <h2>Biến mỗi giao dịch thành dữ liệu để ra quyết định tốt hơn</h2>
            <p>Nhật ký đa thị trường dành cho nhà đầu tư Việt Nam: ghi lại bối cảnh, đo kỷ luật, kiểm soát rủi ro và chỉ kết luận lợi thế khi mẫu dữ liệu đủ lớn.</p>
            <div className="overview-actions">
              <button className="gold-button compact" onClick={() => onAdd()}><Plus size={16} /> Ghi giao dịch</button>
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
          {marketRollup.map((market) => <article key={market.id}><div><span>{market.icon}</span><div><small>{market.label}</small><strong>{market.stats.total} lệnh</strong></div></div><b className={market.stats.net >= 0 ? "positive-text" : "negative-text"}>{Number.isFinite(market.stats.net)?money(market.stats.net,true):'—'}</b></article>)}
        </div>
        <div className="metric-grid">
          {metricRegistry.map(def=>{const m=metrics[def.id];return <article key={def.id} className={'metric-card '+(m.status==='ok'?(m.value>0?'positive':m.value<0?'negative':'neutral'):'neutral')} title={def.formula}><span>{def.id==='roi'?'ROI / Tổng rủi ro':def.labelVi}</span><strong>{metricText(m,def.format)}</strong><small>{m.n}/{m.of} · {m.status==='ok'?'Đủ dữ liệu':m.status==='no-losses'?'Chưa có lệnh lỗ':m.reason}</small></article>;})}
        </div>
        <div className="dashboard-grid">
          <article className="panel panel-wide">
            <div className="panel-title"><div><span className="eyebrow">HIỆU SUẤT TÍCH LŨY</span><h3>Đường cong vốn</h3></div><span className="status-chip">Sổ v3</span></div><p className="panel-copy">VNĐ: mọi sự kiện đã thực hiện · %: {report.riskCount}/{report.ordered.length} lệnh đủ 1R, cùng tập với chỉ số ROI.</p>
            {report.complete?<EquityTimeChart percentEnabled={report.riskCount>0} percentLabel="Net / Tổng 1R (lệnh đủ R)" points={report.rows.map(r=>({date:r.date,money:r.endBalance,percent:r.riskPercent??0}))} ariaLabel="Đường cong vốn theo sự kiện đã thực hiện" moneyLabel="Lãi lỗ tích lũy (VND)"/>:<p>Chưa đủ dữ liệu Net để vẽ đường cong vốn.</p>}
          </article>
          <article className="panel donut-panel">
            <div className="panel-title"><div><span className="eyebrow">PHÂN BỔ KẾT QUẢ</span><h3>Thắng / Thua</h3></div></div>
            <div className="donut" style={donutStyle}><div><strong>{metrics.winRate.status==='ok'?stats.winRate.toFixed(1):'—'}%</strong><span>Tỷ lệ thắng</span></div></div>
            <div className="legend"><span className="win">Thắng {stats.wins}</span><span className="loss">Thua {stats.losses}</span><span className="be">Hòa {stats.breakeven}</span></div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">THEO NGÀY</span><h3>Lãi / Lỗ trong tuần</h3></div></div>
            {!report.complete&&<p>Chưa đủ Net để tổng hợp tuần.</p>}<div className="bar-chart">
              {daily.map((item) => <div className="bar-column" key={item.label}><div className="bar-value">{report.complete?money(item.pnl,true):'—'}</div><div className={`bar ${item.pnl >= 0 ? "up" : "down"}`} style={{ height: `${Math.abs(item.pnl) / maxDaily * 112}px` }} /><span>{item.label.replace("Thứ ", "T")}</span></div>)}
            </div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">QUẢN TRỊ VỐN</span><h3>Kỷ luật rủi ro</h3></div><strong className="positive-text">{metrics.discipline.status==='ok'?stats.discipline.toFixed(0):'—'}%</strong></div>
            <div className="discipline-ring" style={{ "--score": `${stats.discipline * 3.6}deg` } as CSSProperties}><div><strong>{metrics.discipline.status==='ok'?stats.discipline.toFixed(0):'—'}</strong><span>/ 100</span></div></div>
            <p className="panel-copy">Đã review {metrics.discipline.n}/{metrics.discipline.of} lệnh. {stats.discipline >= 90 ? "Bạn đang giữ kỷ luật rất tốt. Hãy tiếp tục ưu tiên chất lượng setup hơn số lượng lệnh." : "Đối chiếu checklist và ghi rõ lý do của các vi phạm để cải thiện lần giao dịch tới."}</p>
          </article>
        </div>
</>;
}
export function AnalysisModes({view,onOpenJournal}:{view:'statistics'|'system-tracker';onOpenJournal:()=>void}) {
 const {derived}=useLedger();
 const [modes,setModes]=useState<Record<string,string>>({});
 useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem('tuan-analysis-view-v1')??'{}');if(stored&&typeof stored==='object')setModes(stored);}catch{}},[]);
 const mode=modes[view]==='v3'?'v3':'classic';
 const choose=(next:string)=>{const value={...modes,[view]:next};setModes(value);try{localStorage.setItem('tuan-analysis-view-v1',JSON.stringify(value));}catch{}};
 return <><section className="analysis-mode-switch" aria-label="Chọn giao diện phân tích"><div role="group" aria-label="Phiên bản giao diện"><button aria-pressed={mode==='classic'} className={mode==='classic'?'active':''} onClick={()=>choose('classic')}>Giao diện gốc</button><button aria-pressed={mode==='v3'} className={mode==='v3'?'active':''} onClick={()=>choose('v3')}>Phân tích v3</button></div><p>Hai giao diện dùng chung sổ giao dịch v3 và bộ lọc phía trên.</p></section>{!derived?<p>Đang đọc dữ liệu…</p>:mode==='v3'?<LedgerPages view={view} legacyTrades={[]} legacyIsDemo={false}/>:view==='statistics'?<TradingMetrix/>:<SystemTracker onOpenJournal={onOpenJournal}/>}</>;
}
