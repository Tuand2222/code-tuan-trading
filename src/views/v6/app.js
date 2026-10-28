const TABS={"gameplan": "tab-gameplan", "cockpit": "tab-cockpit", "workspace": "tab-workspace", "calendar": "tab-calendar", "review": "tab-review", "chartbook": "tab-chartbook", "overview": "tab-edge", "edge": "tab-edge", "drilldown": "tab-edge", "discipline": "tab-edge", "pnlrisk": "tab-pnlrisk", "riskcapital": "tab-riskcapital", "riskedge": "tab-riskedge", "riskopt": "tab-riskopt", "simulation": "tab-simulation", "riskprop": "tab-riskprop", "zones": "tab-zones", "risktools": "tab-risktools", "import": "tab-import", "mapping": "tab-mapping", "dictionary": "tab-dictionary"};
const TITLES={"gameplan": "Kế hoạch và lệnh dự kiến", "calendar": "Lịch giao dịch", "review": "Ghi chú và Review", "chartbook": "Chartbook: thư viện ảnh chụp theo setup", "import": "Nhập nâng cao MT4/MT5 và kết nối sàn", "riskcapital": "Lớp 1 · Bảo vệ vốn & phơi nhiễm", "riskedge": "Lớp 2 · Lợi thế, Omega & ES", "riskopt": "Lớp 3 · Tối ưu vốn & hành vi chuỗi", "riskprop": "Prop Firm Simulator", "risktools": "Trade Engine & Sizer", "zones": "Bảng 4 vùng", "overview": "Tổng quan sức khỏe tài khoản", "workspace": "Giao dịch và bộ lọc", "edge": "Kiểm toán lợi thế thống kê (SQN)", "drilldown": "Phân tích khoan sâu: thời gian, thị trường, phiên", "discipline": "Kỷ luật và quản lý lệnh (MAE/MFE)", "pnlrisk": "Lợi nhuận, rủi ro và drawdown", "simulation": "Mô phỏng Monte Carlo và what-if", "cockpit": "Buồng lái rủi ro: hạn mức lỗ ngày và sụt giảm", "mapping": "Dữ liệu và kết nối", "dictionary": "Trợ giúp và thuật ngữ"};
const TAB_ALIAS={plans:'workspace',journal:'workspace',backup:'mapping',connect:'mapping',sync:'mapping',mt4:'mapping',setup:'dictionary',ui:'dictionary',terms:'dictionary'};
// P3 UI kit and integration. Source-A DOM and rendering bodies are inserted by Python.
const $=id=>document.getElementById(id);
const WD=['CN','T2','T3','T4','T5','T6','T7'];
const DISC_LABEL={NONE:'Đúng kế hoạch',FOMO:'FOMO',MOVE_SL:'Dời SL',EARLY_EXIT:'Thoát sớm',REVENGE:'Trả Thù (Revenge)'};
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayISO=()=>ymd(new Date());
const sumOf=a=>a.reduce((x,y)=>x+y,0);
const netR=t=>t.is_1r_verified===true&&t.is_net_pnl_verified===true?RiskMath.netR(t,state.grossMode):NaN;
const cbEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const E=cbEsc;
const usd=v=>(v<0?'-':'')+'$'+Math.abs(Math.round(v)).toLocaleString('en-US');
const bal=()=>RiskStore.read().equity;
const extraDefaults={plans:[],notes:{},book:[],chk:['Đúng setup trong playbook','Có SL và 1R xác định','R:R từ 2 trở lên','Chưa chạm hạn mức lỗ ngày','Tâm lý ổn định'],unit:'R',avg:false};
const extDefaults={opt:{},kpi:[],hide:[],pip:20,pl:'Pips'};
const ChartRegistry={items:Object.create(null),draw(key,ctx,config){const old=this.items[key];if(old?.ctx)old.destroy();const chart=new Chart(ctx,config);this.items[key]=chart;return chart;},clear(){Object.values(this.items).forEach(c=>c?.destroy());for(const key of Object.keys(this.items))delete this.items[key];}};
const charts=ChartRegistry.items;
let lastDataset=[];
let SORT={k:null,d:1};
const KEYS=['date','symbol','market','side','setup','netPnl','initialRisk','realizedR','mfeR','maeR','discipline'];
const EK=['date','symbol','market','side','setup','netPnl','initialRisk',null,'mfeR','maeR','discipline'];
const OP={market:['STOCKS','FOREX_CFD','FUTURES','CRYPTO','OPTIONS'],side:['Long','Short'],discipline:['NONE','FOMO','MOVE_SL','EARLY_EXIT','REVENGE']};
const NK=['netPnl','initialRisk','mfeR','maeR'];
const FILTER_FIELDS=['filter-market','filter-setup','filter-side','filter-symbol','filter-discipline','filter-result','filter-review','filter-tag','filter-date-range','filter-date-from','filter-date-to','filter-operator','f-rmin','f-rmax','f-wd','f-ses','f-mae'];
const ses=t=>{const h=+(t.hour||'0').slice(0,2);return h>=6&&h<14?'A':h>=14&&h<20?'E':'M';};
let CM=null;
let PR=[];
let tipTimer=null,tipPinned=false;
let editorId=null,editorBaseline=null;
let renderBusy=false;
let largeCiKey=null;
async function ensureLargeCI(){if(state.trades.length>1000&&document.body.dataset.page==='workspace')return;const view=RiskStore.read();if(view.edge.n<=2000||view.journal.ci)return;const key=JSON.stringify(view.edge.returns);if(largeCiKey===key)return;largeCiKey=key;try{const ci=await WorkerBridge.run('analytics',{bootstrapCI:true,R:view.edge.returns});if(JSON.stringify(RiskStore.read().edge.returns)!==key)return;RiskStore.value=freezeView({...RiskStore.read(),journal:{...RiskStore.read().journal,ci}});renderConfidence(RiskStore.value.edge.returns,RiskStore.value.edge.sqn);}catch(error){toast('Chưa tính được khoảng tin cậy: '+error.message);largeCiKey=null;}}

const dictionary = {
            expectancy: {
                title: "Kỳ Vọng Mỗi Lệnh (Expectancy)",
                function: "Đo lường số đơn vị rủi ro (R) trung bình thu về trên mỗi lệnh trong dài hạn.",
                formula: "Expectancy (R) = (Win% × Avg Win R) - (Loss% × Avg Loss R) - Friction",
                scale: "• < 0R: Âm vốn trong dài hạn.<br>• 0.1R – 0.25R: Lợi thế mỏng.<br>• > 0.30R: Lợi thế thống kê vững chắc.",
                action: "Tăng tỷ lệ Win% hoặc lọc các lệnh có R:R thấp để đẩy Expectancy lên mức > 0.3R."
            },
            sqn: {
                title: "Chất Lượng Hệ Thống (SQN - System Quality Number)",
                function: "Chỉ số Van Tharp đánh giá độ tin cậy và sự ổn định của đường cong vốn.",
                formula: "SQN = sqrt( min(N, 100) ) × ( Mean(R) / StdDev(R) )",
                scale: "• < 1.6: Kém.<br>• 1.6 – 2.4: Trung bình.<br>• 2.5 – 2.9: Tốt.<br>• > 3.0: Xuất sắc.",
                action: "Triệt tiêu lệnh thua đậm (<-1.5R) để giảm độ lệch chuẩn StdDev(R), giúp điểm SQN tăng vọt."
            },
            profit_factor: {
                title: "Hệ Số Lợi Nhuận (Profit Factor)",
                function: "Tỷ lệ giữa tổng lợi nhuận gộp chia cho tổng thua lỗ gộp phát sinh.",
                formula: "Profit Factor = Gross Profit ($) / |Gross Loss ($)|",
                scale: "• < 1.0: Thua lỗ ròng.<br>• 1.5 – 2.0: Hệ thống giao dịch bền vững.<br>• > 2.0: Vượt trội.",
                action: "Tránh cắt lời quá non để tăng Gross Profit."
            },
            exit_efficiency: {
                title: "Hiệu Suất Chốt Lời (Exit Efficiency / Capture Rate)",
                function: "Tỷ lệ phần trăm lợi nhuận thực thu so với mức đỉnh MFE cao nhất lệnh từng đạt.",
                formula: "Exit Efficiency (%) = ( Realized PnL / Max Favorable Excursion ) × 100",
                scale: "• < 45%: Chốt lời quá sớm do sợ hãi.<br>• 60% - 70%: Mục tiêu tối ưu.<br>• > 80%: Xuất sắc.",
                action: "Áp dụng Trailing Stop theo EMA hoặc chốt 50% tại Target để tăng tỷ lệ giữ lệnh."
            },
            max_drawdown: {
                title: "Mức Sụt Giảm Vốn Tối Đa (Max Drawdown)",
                function: "Khoảng sụt giảm sâu nhất từ đỉnh số dư cao nhất xuống đáy tài khoản chìm.",
                formula: "Max Drawdown (R) = Max( Peak Equity R - Trough Equity R )",
                scale: "• < 5R: An toàn.<br>• 5R - 10R: Mức vừa phải.<br>• > 10R: Vi phạm hạn mức quản trị.",
                action: "Khi chạm Max Drawdown cá nhân, giảm 50% khối lượng vị thế lập tức."
            },
            recovery_factor: {
                title: "Hệ Số Phục Hồi (Recovery Factor)",
                function: "Khả năng bật dậy lợi nhuận tích lũy so với mức sụt giảm lớn nhất.",
                formula: "Recovery Factor = Total Net Profit ($) / Max Drawdown ($)",
                scale: "• < 1.0: Chưa đủ bù đắp rủi ro.<br>• > 2.0: Lợi nhuận tích lũy bù đắp xứng đáng.",
                action: "Chỉ số càng cao chứng tỏ tài khoản vượt qua chuỗi thua nhanh chóng."
            },
            mfe: {
                title: "Biên Độ Lợi Nhuận Tiềm Năng (MFE - Max Favorable Excursion)",
                function: "Mức lợi nhuận chưa thực hiện cao nhất lệnh chạm tới trước khi đóng.",
                formula: "MFE (R) = Max( Unrealized Profit ) / 1R",
                scale: "MFE gấp 3 lần Realized R -> Bạn đang chốt quá non.",
                action: "Đặt cảnh báo giá tại mốc 2R MFE để dịch Stoploss về Breakeven."
            },
            mae: {
                title: "Biên Độ Chịu Nhiệt Vị Thế (MAE - Max Adverse Excursion)",
                function: "Mức sụt giảm âm tạm thời lớn nhất lệnh chịu đựng trước khi đóng.",
                formula: "MAE (R) = Max( Unrealized Loss ) / 1R",
                scale: "Nếu 90% lệnh thắng có MAE < 0.4R -> Dặt Stop Loss 1.0R là quá rộng.",
                action: "Thu hẹp Stop Loss về 0.6R để tăng khối lượng vị thế."
            },
            r_distribution: {
                title: "Phân Phối Xác Suất R-Multiple",
                function: "Trực quan hóa hình dạng phân phối kết quả lệnh.",
                formula: "Bins: <-1R, -1R..0R, 0R..1R, 1R..3R, >3R",
                scale: "Mô hình chuẩn: Thua cố định ở -1R và thắng kéo dài sang phải (+2R, +4R).",
                action: "Triệt tiêu cột nằm bên trái -1R (lệnh gồng lỗ vi phạm kỷ luật)."
            },
            stability: {
                title: "Hệ số ổn định (R-Stability)",
                function: "Tỷ lệ giữa R trung bình và độ lệch chuẩn của R, không phụ thuộc số lệnh.",
                formula: "Stability = Mean(R) / StdDev(R)",
                scale: "Cùng kỳ vọng, độ lệch chuẩn thấp hơn thì hệ số cao hơn.",
                action: "Cắt lỗ dứt khoát và chuẩn hóa quy tắc chốt lời để giảm dao động."
            },
            sharpe_calmar: {
                title: "Sharpe, Sortino, Calmar",
                function: "Lợi nhuận điều chỉnh theo biến động chung (Sharpe), biến động xuống (Sortino) và sụt giảm lớn nhất (Calmar).",
                formula: "Sharpe = Mean(R)/StdDev(R) · Sortino = Mean(R)/Downside Dev · Calmar = Tổng R / Max DD (R)",
                scale: "Số ở đây tính theo lệnh, chưa quy đổi theo năm, nên không so trực tiếp với Sharpe theo năm của quỹ. Calmar chỉ có ý nghĩa khi lịch sử kéo dài nhiều tháng.",
                action: "Giảm sụt giảm lớn nhất trước khi tăng khối lượng."
            },
            daily_loss: {
                title: "Hạn mức lỗ ngày",
                function: "Cho biết lỗ trong ngày đã dùng bao nhiêu phần trăm hạn mức.",
                formula: "Lỗ ngày đã dùng / Hạn mức × 100%",
                scale: "Dưới 70%: an toàn · 70–99%: cảnh báo · từ 100%: vượt hạn mức.",
                action: "Chạm 70% thì giảm khối lượng hoặc dừng giao dịch trong ngày."
            },
            dd_limit: {
                title: "Sụt giảm tài khoản so với hạn mức",
                function: "Mức sụt từ mốc tham chiếu so với hạn mức sụt giảm tối đa.",
                formula: "Static = Vốn đầu − Số dư · Trailing = Đỉnh số dư − Số dư",
                scale: "Dưới 70%: an toàn · 70–99%: cảnh báo · từ 100%: vượt hạn mức.",
                action: "Đối chiếu kiểu tính (static hay trailing) với quy định thật của quỹ."
            },
            hold_time: {
                title: "Thời gian giữ lệnh vs R",
                function: "So sánh thời gian giữ của lệnh thắng và lệnh thua.",
                formula: "Hold (phút) = Giờ đóng − Giờ mở",
                scale: "Cần từ 30 lệnh có dữ liệu mới đủ tin cậy; mẫu nhỏ chỉ để tham khảo. Đây là tương quan, không chứng minh nguyên nhân.",
                action: "Nếu lệnh thua bị giữ lâu hơn lệnh thắng, rà lại các lệnh đó xem có dời SL hay không."
            },
            underwater: {
                title: "Đường Cong Sụt Giảm Vốn Chìm",
                function: "Thời gian và mức độ chìm dưới đỉnh số dư theo từng lệnh.",
                formula: "Drawdown_i (%) = ( Equity_i - Peak_Equity ) / Peak_Equity × 100",
                scale: "Đường tiệm cận 0% càng nhiều chứng tỏ liên tục phá đỉnh.",
                action: "Theo dõi chu kỳ chìm để chuẩn bị tâm lý cho giai đoạn drawdown."
            }
        };
const CB_FIELDS={market:'Thị trường',setup:'Setup',side:'Chiều',discipline:'Lỗi kỷ luật',review:'Review',tag:'Nhãn'};
const CB_SEEDS={};
const EDGE_VIEWS={overview:['kpi','chart-drawdown'],edge:['kpi','chart-rdist','other'],drilldown:['heatmap-container','breakdown-container'],discipline:['discipline-cost','chart-mfe','chart-mae','chart-hold']};
const I='border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm w-full bg-white';
const B='bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold';
const card=(h,b)=>'<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3"><h2>'+h+'</h2>'+b+'</div>';
const fld=(l,id,t,v)=>'<label class="text-xs font-semibold text-slate-500 block">'+l+'<input id="'+id+'" type="'+(t||'number')+'" step="any" value="'+(v==null?'':v)+'" class="'+I+' mt-1"></label>';
const mk=s=>{s=s.toUpperCase();return /USDT$|USDC$|^(BTC|ETH|SOL|BNB)/.test(s)?'CRYPTO':/^VN30F|^41I|^(ES|NQ|YM|CL|GC)\d*$/.test(s)?'FUTURES':/^[A-Z]{6}$|^XAU|^XAG|OIL/.test(s)?'FOREX_CFD':'STOCKS';};
const plan=()=>{const e=+$('gp-e').value,s=+$('gp-s').value,t=+$('gp-t').value,r=+$('gp-r').value||state.defaultRisk1R,d=Math.abs(e-s);return{e,s,t,r,d,size:d?r/d:0,rr:d&&t?Math.abs(t-e)/d:0};};
const shift=n=>{const[y,m]=CM.split('-').map(Number),d=new Date(y,m-1+n,1);CM=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');renderCalendar();};
const wkOf=d=>{d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const n=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-n);const y=d.getUTCFullYear();return y+'-W'+String(Math.ceil(((d-Date.UTC(y,0,1))/864e5+1)/7)).padStart(2,'0');};
const RV=[['r1','1. Quy tắc tuần này'],['r2','2. Tiêu điểm tuần trước'],['r3','3. Một hành động cải thiện cho tuần tới']];
const num=s=>{s=String(s||'').replace(/[^\d.,\-]/g,'');if(!s)return NaN;const a=s.lastIndexOf('.'),b=s.lastIndexOf(',');if(a>=0&&b>=0)s=a>b?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');else if(b>=0)s=/^-?\d{1,3}(,\d{3})+$/.test(s)?s.replace(/,/g,''):s.replace(',','.');else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');return parseFloat(s);};
const BK=(t,d)=>{const[h,m]=(t.hour||'00:00').split(':').map(Number);if(d==='session')return h>=6&&h<14?'Phiên Á (06–14h)':h>=14&&h<20?'Phiên Âu (14–20h)':'Phiên Mỹ (20–06h)';if(/^h\d+$/.test(d)){const z=+d.slice(1);return String(h).padStart(2,'0')+':'+String(Math.floor(m/z)*z).padStart(2,'0');}return t[d];};
const tipBtn=e=>e.target.closest&&e.target.closest('button[onclick*="openTooltipModal"]');
const KI=['kpi-expectancy','kpi-sqn','kpi-pf','kpi-exit-eff','kpi-dd','kpi-recovery'];const KN=['Expectancy','SQN','Profit Factor','Exit Efficiency','Max Drawdown','Recovery Factor'];let cd={},kg;
const ord=()=>{const o=state.ext2.kpi.filter(i=>KI.includes(i));KI.forEach(i=>o.includes(i)||o.push(i));return o;};
const cat=e=>e.closest('[id^="cb-"]').id.slice(3);

function writeData(mutator){try{Core.commit(mutator);return true;}catch(error){toast('Không lưu được dữ liệu: '+error.message);return false;}}
function snapshot(){return Core.snapshot();}
function restore(){return Core.restore();}
function applySaved(value){try{Core.replace(value);return true;}catch(_){return false;}}
function fmtR(v){if(v==null||!isFinite(v))return '–';const unit=state.extra.unit;if(unit==='P')return(v>0?'+':'')+(v*state.ext2.pip).toFixed(1)+' '+state.ext2.pl;if(unit==='$')return(v>0?'+':v<0?'-':'')+'$'+Math.abs(Math.round(v*state.defaultRisk1R)).toLocaleString('en-US');if(unit==='%')return(v>0?'+':'')+(v*state.defaultRisk1R/bal()*100).toFixed(2)+'%';return(v>0?'+':'')+v.toFixed(2)+' R';}
function persist(){return writeData(()=>{});}

function weekdayOf(d){return WD[new Date(d+'T00:00:00').getDay()];}
function toast(m){const e=document.createElement('div');e.textContent=m;e.className='fixed bottom-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2 rounded-lg shadow-lg';document.body.appendChild(e);setTimeout(()=>e.remove(),2500);}
function syncSettingsUI(){
            const s=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
            s('setting-initial-cap',state.initialCapital);$('setting-initial-cap').readOnly=!!state.extra.classicSync?.owner;s('setting-default-1r',state.defaultRisk1R);s('setting-friction',state.frictionCostR);
            const c=document.getElementById('setting-sqn-cap');if(c)c.checked=state.sqnCapEnabled;
            const l=document.getElementById('label-friction-val');if(l)l.textContent=state.frictionCostR.toFixed(2)+' R';
        }
function applyEdgeView(view){
            const root=document.getElementById('tab-edge'),want=EDGE_VIEWS[view]||EDGE_VIEWS.edge;
            const keys=['chart-hold','chart-mfe','chart-mae','chart-rdist','chart-drawdown','heatmap-container','discipline-cost','breakdown-container'];
            [...root.children].forEach((c,i)=>{
                if(i===0){c.classList.add('hidden');return;}
                if(c.querySelector('[id^="kpi-"]')){c.classList.toggle('hidden',!want.includes('kpi'));return;}
                const cards=c.classList.contains('grid')?[...c.children]:[c];
                cards.forEach(card=>{const k=keys.find(k=>card.querySelector('#'+k))||'other';card.classList.toggle('hidden',!want.includes(k));});
            });
        }
function renderHoldChart(trades){
            const wrap=document.getElementById('hold-wrap'),note=document.getElementById('hold-note');if(!wrap)return;
            if(charts.hold){charts.hold.destroy();charts.hold=null;}
            const d=(trades||[]).filter(t=>typeof t.holdMin==='number'&&isFinite(t.holdMin)&&t.holdMin>=0&&Number.isFinite(netR(t)));
            if(d.length<2){wrap.classList.add('hidden');note.textContent='Có '+d.length+'/'+(trades||[]).length+' lệnh có thời gian giữ. Cần tối thiểu 2 lệnh để vẽ; nhập ở ô "Thời gian giữ (phút)" khi thêm lệnh hoặc qua tệp sao lưu (trường holdMin).';return;}
            wrap.classList.remove('hidden');
            const pts=d.map(t=>({x:t.holdMin,y:netR(t)}));
            charts.hold=ChartRegistry.draw('hold',document.getElementById('chart-hold').getContext('2d'),{type:'scatter',data:{datasets:[{data:pts,backgroundColor:pts.map(p=>p.y>=0?'#10b981':'#f43f5e'),pointRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:'Thời gian giữ (phút)'},beginAtZero:true},y:{title:{display:true,text:'Kết quả (R, sau phí)'}}}}});
            const w=d.filter(t=>netR(t)>0),l=d.filter(t=>netR(t)<0),avg=a=>a.length?Math.round(sumOf(a.map(t=>t.holdMin))/a.length)+' phút (n='+a.length+')':'chưa có';
            note.textContent='Giữ trung bình lệnh thắng: '+avg(w)+' · lệnh thua: '+avg(l)+'. Dùng '+d.length+'/'+trades.length+' lệnh'+(d.length<30?'; mẫu dưới 30 lệnh, chỉ mang tính tham khảo.':'.');
        }
function cbSel(cat){const e=document.getElementById('filter-'+cat);return !e||!e.value||e.value==='ALL'?[]:e.value.split('|');}
const optionIndex={revision:-1,pools:{},counts:{}};
function cbPool(cat){if(optionIndex.revision!==coreRevision){optionIndex.revision=coreRevision;optionIndex.pools={};optionIndex.counts={};}if(optionIndex.pools[cat])return optionIndex.pools[cat];
            const m=new Map();(CB_SEEDS[cat]||[]).forEach(o=>m.set(o.v,o.l));
            (state.customOptions[cat]||[]).forEach(v=>{if(!m.has(v))m.set(v,v);});
            const counts=new Map();state.trades.forEach(t=>{const v=t[cat];counts.set(v,(counts.get(v)||0)+1);if(v&&!m.has(v))m.set(v,v);});optionIndex.counts[cat]=counts;
            return optionIndex.pools[cat]=[...m].map(([v,l])=>({v,l:state.ext2.opt[cat]?.[v]?.l||l}));
        }
function cbSet(cat,arr){document.getElementById('filter-'+cat).value=arr.length?arr.join('|'):'ALL';updateFilters();}
function cbAdd(cat,val){
            val=(val||'').trim();if(!val)return;
            const same=o=>o.l.toLowerCase()===val.toLowerCase()||o.v===val;
            if(!cbPool(cat).some(same)){if(!writeData(d=>(d.customOptions[cat]=d.customOptions[cat]||[]).push(val)))return;}
            const o=cbPool(cat).find(same),s=cbSel(cat);if(!s.includes(o.v))s.push(o.v);
            renderCustomTagsPills();cbSet(cat,s);
        }
function cbRender(cat){
            const wrap=document.getElementById('cb-'+cat);if(!wrap)return;
            const pool=cbPool(cat),sel=cbSel(cat),lab=v=>(pool.find(o=>o.v===v)||{l:v}).l;
            wrap.querySelector('.cb-trigger').innerHTML=sel.length?sel.map(v=>'<span class="inline-flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2 text-xs font-medium">'+cbEsc(lab(v))+'<span class="cb-x cursor-pointer" data-x="'+cbEsc(v)+'" aria-label="Gỡ điều kiện">×</span></span>').join(''):'<span class="text-slate-500">Tất cả</span>';
            const raw=wrap.querySelector('.cb-search').value.trim(),q=raw.toLowerCase(),cnt=v=>optionIndex.counts[cat]?.get(v)||0;
            let html=pool.filter(o=>!q||o.l.toLowerCase().includes(q)).slice(0,200).map(o=>{const n=cnt(o.v),del=(state.customOptions[cat]||[]).includes(o.v)&&n===0;
                return '<label class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-sm cursor-pointer"><input type="checkbox" class="cb-opt" data-v="'+cbEsc(o.v)+'"'+(sel.includes(o.v)?' checked':'')+'><span class="flex-1">'+cbEsc(o.l)+'</span><span class="text-xs text-slate-400 tabular-nums">'+n+'</span>'+(del?'<button type="button" class="cb-del text-slate-400 hover:text-rose-600" data-v="'+cbEsc(o.v)+'" aria-label="Xóa lựa chọn">🗑</button>':'')+'</label>';}).join('');
            if(pool.length>200)html+='<p class="text-xs text-slate-500 px-2">Hiển thị tối đa 200 lựa chọn; gõ để tìm trong toàn bộ danh sách.</p>';
            if(q&&!pool.some(o=>o.l.toLowerCase()===q))html+='<button type="button" class="cb-add w-full text-left px-2 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50 rounded">+ Thêm mới “'+cbEsc(raw)+'”</button>';
            wrap.querySelector('.cb-list').innerHTML=html||'<div class="px-2 py-1 text-xs text-slate-500">Không có lựa chọn</div>';
        const w=$('cb-'+cat);if(!w)return;const col=v=>((state.ext2.opt[cat]||{})[v]||{}).c;
w.querySelectorAll('.cb-list label').forEach(lb=>{const o=lb.querySelector('.cb-opt');if(!o)return;const v=o.dataset.v;lb.insertAdjacentHTML('afterbegin','<input type="color" class="cb-col w-4 h-4 p-0 border-0 bg-transparent cursor-pointer" data-v="'+E(v)+'" value="'+(col(v)||'#94a3b8')+'" aria-label="Đổi màu">');lb.querySelector('span.flex-1').insertAdjacentHTML('afterend','<button type="button" class="cb-ren text-slate-400 hover:text-brand-600 text-xs" data-v="'+E(v)+'" aria-label="Đổi tên">✎</button>');});
w.querySelectorAll('.cb-trigger .cb-x').forEach(x=>{const c=col(x.dataset.x);if(c)x.parentElement.style.cssText='border-color:'+c+';color:'+c;});}
function cbInit(){
            Object.keys(CB_FIELDS).forEach(cat=>{
                const sel=document.getElementById('filter-'+cat);if(!sel||sel.tagName!=='SELECT')return;
                CB_SEEDS[cat]=[...sel.options].filter(o=>o.value!=='ALL').map(o=>({v:o.value,l:o.textContent.trim()}));
                const lb=sel.closest('label');if(lb){const d=document.createElement('div');d.className=lb.className;while(lb.firstChild)d.appendChild(lb.firstChild);lb.replaceWith(d);}
                const wrap=document.createElement('div');wrap.id='cb-'+cat;wrap.className='relative';
                wrap.innerHTML='<input type="hidden" id="filter-'+cat+'" value="ALL"><button type="button" class="cb-trigger w-full min-h-[34px] text-left border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-sm flex flex-wrap gap-1 items-center" aria-haspopup="listbox" aria-label="'+CB_FIELDS[cat]+'"></button><div class="cb-panel hidden absolute z-40 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-2 space-y-1"><input type="text" class="cb-search w-full border border-slate-200 rounded px-2 py-1 text-sm" placeholder="Tìm hoặc gõ để tạo mới" aria-label="Tìm '+CB_FIELDS[cat]+'"><div class="cb-list"></div></div>';
                sel.replaceWith(wrap);
                const panel=wrap.querySelector('.cb-panel'),search=wrap.querySelector('.cb-search'),trig=wrap.querySelector('.cb-trigger');
                wrap.addEventListener('click',e=>{
                    const x=e.target.closest('.cb-x');if(x){cbSet(cat,cbSel(cat).filter(v=>v!==x.dataset.x));return;}
                    if(e.target.closest('.cb-trigger')){panel.classList.toggle('hidden');trig.setAttribute('aria-expanded',!panel.classList.contains('hidden'));if(!panel.classList.contains('hidden')){cbRender(cat);search.focus();}return;}
                    const del=e.target.closest('.cb-del');if(del){e.preventDefault();const v=del.dataset.v;writeData(d=>d.customOptions[cat]=(d.customOptions[cat]||[]).filter(i=>i!==v));renderCustomTagsPills();cbSet(cat,cbSel(cat).filter(i=>i!==v));return;}
                    if(e.target.closest('.cb-add')){const v=search.value;search.value='';cbAdd(cat,v);}
                });
                wrap.addEventListener('change',e=>{const c=e.target.closest('.cb-opt');if(!c)return;const s=cbSel(cat),v=c.dataset.v;cbSet(cat,c.checked?[...s,v]:s.filter(i=>i!==v));});
                search.addEventListener('input',()=>cbRender(cat));
                search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const a=wrap.querySelector('.cb-add');if(a)a.click();}if(e.key==='Escape')panel.classList.add('hidden');});
            });
            document.addEventListener('click',e=>document.querySelectorAll('.cb-panel').forEach(p=>{if(!p.parentElement.contains(e.target))p.classList.add('hidden');}));
            const dl=document.createElement('datalist');dl.id='symbol-list';document.body.appendChild(dl);document.getElementById('filter-symbol').setAttribute('list','symbol-list');
        }
function cbWriteUrl(){
            const parts=[],op=document.getElementById('filter-operator').value;if(op==='OR')parts.push('operator=OR');
            Object.keys(CB_FIELDS).forEach(c=>{const s=cbSel(c);if(s.length)parts.push(c+'='+s.map(encodeURIComponent).join(','));});
            try{history.replaceState(null,'','#'+(rawTab()||'workspace')+(parts.length?'?'+parts.join('&'):''));}catch(e){}
        }
function cbBuildForm(){
            let box=document.getElementById('risk-edit-extra');
            box.innerHTML=[['market','Thị trường'],['side','Chiều'],['setup','Setup'],['discipline','Lỗi kỷ luật'],['review','Review'],['tag','Nhãn (tùy chọn)']].map(([c,l])=>'<div><label class="block text-slate-600 font-semibold mb-1" for="risk-edit-'+c+'">'+l+'</label><select id="risk-edit-'+c+'" class="w-full border rounded px-2.5 py-1.5"><option value="">— chọn —</option>'+formOptionPool(c).map(o=>'<option value="'+cbEsc(o.v)+'">'+cbEsc(o.l)+'</option>').join('')+'</select></div>').join('');
        }
function showTip(btn,pin){
            const m=(btn.getAttribute('onclick')||'').match(/openTooltipModal\('([^']+)'\)/),it=m&&dictionary[m[1]];if(!it)return;
            let e=document.getElementById('tip-pop');
            if(!e){e=document.createElement('div');e.id='tip-pop';e.setAttribute('role','tooltip');e.className='hidden fixed z-[60] w-[320px] max-w-[92vw] bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs leading-normal text-slate-700 space-y-2';document.body.appendChild(e);}
            e.innerHTML='<div class="text-sm font-bold text-slate-900">'+it.title+'</div><div><b>Chức năng:</b> '+it.function+'</div><div><b>Công thức:</b> <span class="font-mono">'+cbEsc(it.formula)+'</span></div><div><b>Thang chuẩn:</b> '+it.scale+'</div><div><b>Hành động:</b> '+it.action+'</div>';
            e.classList.remove('hidden');const r=btn.getBoundingClientRect();
            e.style.left=Math.max(8,Math.min(innerWidth-e.offsetWidth-8,r.left))+'px';
            e.style.top=(r.bottom+8+e.offsetHeight<innerHeight?r.bottom+8:Math.max(8,r.top-8-e.offsetHeight))+'px';tipPinned=!!pin;
        }
function hideTip(force){if(tipPinned&&!force)return;const e=document.getElementById('tip-pop');if(e)e.classList.add('hidden');tipPinned=false;}
function applyTheme(t){document.documentElement.classList.toggle('dark',t==='dark');Chart.defaults.color=t==='dark'?'#94a3b8':'#475569';Chart.defaults.borderColor=t==='dark'?'#334155':'#e2e8f0';const b=document.getElementById('btn-theme');if(b)b.textContent=t==='dark'?'☀ Sáng':'🌙 Tối';}
function syncGrossBtn(){const b=document.getElementById('btn-gross');if(b)b.textContent=state.grossMode?'Gross R (chưa trừ phí)':'Net R (đã trừ phí)';}
function renderRiskRatios(trades){trades=(trades||[]).filter(t=>Number.isFinite(netR(t)));
            const box=document.getElementById('risk-ratio-cards'),note=document.getElementById('risk-note');if(!box)return;
            if(charts.equity){charts.equity.destroy();charts.equity=null;}
            const ts=[...(trades||[])].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.id-b.id),n=ts.length;
            if(n<2){box.innerHTML='<p class="text-xs text-slate-500 col-span-full">Cần tối thiểu 2 lệnh đã đóng để tính.</p>';note.textContent='';return;}
            const shared=RiskStore.read(),j=shared.journal,eq=j.curve,ulcer=j.ulcer,days=j.days,f=v=>isFinite(v)?v.toFixed(2):'–';
const card=(l,v,k)=>'<div class="rounded-lg border border-slate-200 p-3"><div class="text-xs font-semibold text-slate-500">'+l+(k?'<button onclick="openTooltipModal(\''+k+'\')" class="ml-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-brand-600 inline-flex items-center justify-center font-bold" aria-label="Giải thích">?</button>':'')+'</div><div class="text-2xl font-bold tabular-nums text-slate-900 mt-1">'+v+'</div></div>';
            box.innerHTML=card('Sharpe (theo lệnh)',f(j.sharpe),'sharpe_calmar')+card('Sortino (theo lệnh)',f(j.sortino),'sharpe_calmar')+card('Calmar (Tổng R / Max DD)',f(j.calmar),'sharpe_calmar')+card('Ulcer Index (R)',f(ulcer),'')+card('Hệ số ổn định',f(j.sharpe),'stability');
            box.className='grid grid-cols-2 lg:grid-cols-5 gap-4';
            note.textContent='Dựa trên '+n+' lệnh, R Net P&L / 1R đã xác minh'+(state.grossMode?' · Gross chỉ đối chiếu bảng lệnh':'')+'.'+(n<30?' Mẫu dưới 30 lệnh, chỉ mang tính tham khảo.':'')+(days<90?' Lịch sử dưới 3 tháng nên Calmar có thể bị phóng đại.':'');
            charts.equity=ChartRegistry.draw('equity',document.getElementById('chart-equity').getContext('2d'),{type:'line',data:{labels:j.dates,datasets:[{data:eq,borderWidth:2,pointRadius:2,tension:0,fill:{target:'origin',above:'rgba(16,185,129,.15)',below:'rgba(244,63,94,.15)'},segment:{borderColor:c=>(c.p0.parsed.y+c.p1.parsed.y)/2>=0?'#10b981':'#f43f5e'}}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'R lũy kế'}}}}});
        }
function promptAddCustomOption(category) {
            const categoryNames = {
                market: 'Thị Trường Mới',
                setup: 'Setup / Chiến Lược Mới',
                discipline: 'Lỗi Kỷ Luật Mới',
                tag: 'Nhãn / Tag Mới'
            };
            document.getElementById('custom-modal-title').textContent = `Thêm ${categoryNames[category]}`;
            document.getElementById('custom-option-target-category').value = category;
            document.getElementById('custom-option-input').value = '';
            document.getElementById('custom-option-modal').classList.remove('hidden');
        }
function closeCustomOptionModal() {
            document.getElementById('custom-option-modal').classList.add('hidden');
        }
function confirmAddCustomOption() {
            const cat = document.getElementById('custom-option-target-category').value;
            cbAdd(cat, document.getElementById('custom-option-input').value);
            closeCustomOptionModal();
        }
function renderCustomTagsPills() {

            const container = document.getElementById('custom-tags-container');
            let html = '<span class="text-xs font-semibold text-slate-400">Tùy chọn đã thêm:</span>';

            let count = 0;
            Object.keys(state.customOptions).forEach(cat => {
                state.customOptions[cat].forEach(item => {
                    count++;
                    html += `
                    <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold">
                        <span>${cbEsc(item)}</span>
                        <button data-option-cat="${cbEsc(cat)}" data-option-value="${cbEsc(item)}" class="text-brand-500 hover:text-rose-600 ml-1">✕</button>
                    </span>`;
                });
            });

            if (count === 0) html += '<span class="text-slate-400 italic">Chưa có tùy chọn tự thêm</span>';
            container.innerHTML = html;
        }
function removeCustomOption(category, item) {
            if(!writeData(d=>d.customOptions[category]=(d.customOptions[category]||[]).filter(i=>i!==item)))return;
            renderCustomTagsPills();
            cbSet(category, cbSel(category).filter(v => v !== item));
        }
function getActiveConditions(){
            const g=id=>document.getElementById('filter-'+id),conds=[];
            const add=(id,fn)=>{const e=g(id);if(e.value!=='ALL')conds.push({label:e.options[e.selectedIndex].text,test:t=>fn(t,e.value)});};
            ['market','setup','side','discipline','review','tag'].forEach(cat=>{const s=cbSel(cat);if(s.length){const pool=cbPool(cat);conds.push({label:CB_FIELDS[cat]+': '+s.map(v=>(pool.find(o=>o.v===v)||{l:v}).l).join(' + '),test:t=>s.includes(t[cat])});}});
            add('result',(t,v)=>v==='WIN'?t.realizedR>0:v==='LOSS'?t.realizedR<0:v==='BIG_WIN'?t.realizedR>=2:true);
            const sym=g('symbol').value.trim().toLowerCase();
            if(sym)conds.push({label:'Mã: '+sym.toUpperCase(),test:t=>t.symbol.toLowerCase().includes(sym)});
            const c=conds,v=i=>$(i).value,n=i=>v(i)===''?null:+v(i),lo=n('f-rmin'),hi=n('f-rmax'),m=n('f-mae'),w=v('f-wd'),s=v('f-ses');
if(lo!=null||hi!=null)c.push({label:'R: '+(lo==null?'…':lo)+' → '+(hi==null?'…':hi),test:t=>{const r=netR(t);return(lo==null||r>=lo)&&(hi==null||r<=hi);}});
if(w!=='ALL')c.push({label:'Thứ: '+w,test:t=>t.weekday===w});
if(s!=='ALL')c.push({label:'Phiên: '+$('f-ses').selectedOptions[0].text,test:t=>ses(t)===s});
if(m!=null)c.push({label:'MAE ≥ '+m+' R',test:t=>typeof t.maeR==='number'&&Math.abs(t.maeR)>=m});return c;}
function dateScope(){
            const rng=document.getElementById('filter-date-range'),from=document.getElementById('filter-date-from').value,to=document.getElementById('filter-date-to').value;
            const n=new Date(),y=n.getFullYear(),m=n.getMonth();let lo='',hi='';
            if(rng.value==='THIS_MONTH'){lo=ymd(new Date(y,m,1));hi=ymd(new Date(y,m+1,0));}
            else if(rng.value==='LAST_MONTH'){lo=ymd(new Date(y,m-1,1));hi=ymd(new Date(y,m,0));}
            else if(rng.value==='YTD'){lo=y+'-01-01';}
            if(from&&from>lo)lo=from;if(to&&(!hi||to<hi))hi=to;
            const label=(rng.value!=='ALL'?rng.options[rng.selectedIndex].text:'')+(from||to?' '+(from||'…')+' → '+(to||'…'):'');
            return {lo,hi,label:label.trim()};
        }
function renderFilterChips(conds,n,op,scope){
            const chips=(scope.label?[scope.label]:[]).concat(conds.map(c=>c.label));
            document.getElementById('filter-summary').textContent=n+' / '+state.trades.length+' lệnh'+(conds.length>1?(op==='AND'?' · khớp tất cả điều kiện':' · khớp ít nhất một điều kiện'):'');
            document.getElementById('filter-chips').innerHTML=chips.map(c=>'<span class="bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2.5 py-0.5 font-medium">'+cbEsc(c)+'</span>').join('');
            document.getElementById('filter-clear').classList.toggle('hidden',chips.length===0);
        }
function updateFilters() {Object.keys(CB_FIELDS).forEach(cbRender);const dl=$('symbol-list');if(dl&&dl.dataset.revision!==String(coreRevision)){dl.dataset.revision=String(coreRevision);dl.innerHTML=[...new Set(state.trades.map(t=>t.symbol))].sort().slice(0,2000).map(s=>'<option value="'+cbEsc(s)+'">').join('');}
            const op=document.getElementById('filter-operator').value,conds=getActiveConditions(),scope=dateScope();
            const filtered=state.trades.filter(t=>{
                if((scope.lo&&t.date<scope.lo)||(scope.hi&&t.date>scope.hi))return false;
                if(!conds.length)return true;
                return op==='AND'?conds.every(c=>c.test(t)):conds.some(c=>c.test(t));
            });
            document.getElementById('filtered-count').textContent=filtered.length;
            document.getElementById('alert-disc').textContent=state.trades.filter(t=>t.discipline!=='NONE').length;
            renderFilterChips(conds,filtered.length,op,scope);
            RiskStore.select(filtered.map(t=>String(t.id)));renderWorkspaceTable(filtered);
            recalculateAndRender(filtered);
        const spans=$('alerts-bar').querySelectorAll(':scope > span');if(spans.length>=4){const missing=state.trades.filter(t=>t.is_1r_verified!==true||!(t.initialRisk>0)||t.riskEstimated).length,fees=state.trades.filter(t=>t.is_net_pnl_verified===true&&RiskMath.verifiedNet(t)&&(Number.isFinite(t.feeR)||Number.isFinite(t.grossPnl))).length;spans[1].textContent='✔ '+missing+' Chưa có 1R · Đủ phí '+fees+'/'+state.trades.length;spans[2].textContent='⏳ '+state.trades.filter(t=>t.review==='PENDING').length+' Chờ review';spans[3].textContent='🏷️ '+state.trades.filter(t=>!t.tag).length+' Cần gắn lại';}$('v3-safety').hidden=!state.sampleSource;cbWriteUrl();}
function resetFilters() {['f-rmin','f-rmax','f-mae'].forEach(i=>$(i).value='');['f-wd','f-ses'].forEach(i=>$(i).value='ALL');
            document.getElementById('filter-market').value = 'ALL';
            document.getElementById('filter-setup').value = 'ALL';
            document.getElementById('filter-side').value = 'ALL';
            document.getElementById('filter-symbol').value = '';
            document.getElementById('filter-discipline').value = 'ALL';
            document.getElementById('filter-result').value = 'ALL';
            document.getElementById('filter-review').value = 'ALL';
            document.getElementById('filter-tag').value = 'ALL';
            document.getElementById('filter-date-range').value = 'ALL';
            document.getElementById('filter-date-from').value = '';
            document.getElementById('filter-date-to').value = '';
            updateFilters();
        }
function rebuildSavedViews(){
            const dd=document.getElementById('saved-views-dropdown');
            dd.querySelectorAll('option[data-user]').forEach(o=>o.remove());
            state.savedViews.forEach(v=>{const o=document.createElement('option');o.value='user:'+v.name;o.textContent=v.name;o.dataset.user='1';dd.appendChild(o);});
        }
function saveCurrentView(){
            const input=document.getElementById('saved-view-name'),name=input.value.trim();
            if(!name){toast('Nhập tên góc nhìn trước khi lưu');return;}
            const filters={};FILTER_FIELDS.forEach(id=>filters[id]=document.getElementById(id).value);
            if(!writeData(d=>{d.savedViews=d.savedViews.filter(v=>v.name!==name);d.savedViews.push({name,filters});}))return;
            rebuildSavedViews();document.getElementById('saved-views-dropdown').value='user:'+name;
            input.value='';toast('Đã lưu góc nhìn: '+name);
        }
function loadSavedView(){
            const val=document.getElementById('saved-views-dropdown').value;
            if(val.startsWith('user:')){
                const v=state.savedViews.find(x=>'user:'+x.name===val);if(!v)return;
                FILTER_FIELDS.forEach(id=>{document.getElementById(id).value=(v.filters[id]??(/^f-(wd|ses)$/.test(id)?'ALL':''));});updateFilters();
            }else if(val==='preset_breakout'){
                resetFilters();document.getElementById('filter-setup').value='Breakout';document.getElementById('filter-result').value='BIG_WIN';updateFilters();
            }else if(val==='preset_crypto'){
                resetFilters();document.getElementById('filter-market').value='CRYPTO';updateFilters();
            }
        }
function workspaceRowHtml(t){const realizedR=netR(t),rClass=realizedR>=0?'text-emerald-600 font-bold':'text-rose-600 font-bold';return `
                <tr class="hover:bg-slate-50">
                    <td class="p-3 text-slate-600">${t.date}</td>
                    <td class="p-3 font-bold text-slate-900">${cbEsc(t.symbol)}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">${cbEsc(t.market)}</span></td>
                    <td class="p-3 font-medium">${cbEsc(t.side)}</td>
                    <td class="p-3 text-slate-700">${cbEsc(t.setup)}</td>
                    <td class="p-3 font-bold ${t.netPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${t.is_net_pnl_verified===true&&RiskMath.verifiedNet(t)?(t.netPnl>0?'▲ ':t.netPnl<0?'▼ ':'● ')+'$'+t.netPnl:'○ Chưa xác minh'}</td>
                    <td class="p-3 text-slate-600">${t.initialRisk>0?'$'+t.initialRisk:'–'}</td>
                    <td class="p-3 ${rClass}">${Number.isFinite(realizedR)?(realizedR>=0?'+':'')+realizedR.toFixed(2)+' R':'○ Chưa xác minh'}</td>
                    <td class="p-3 text-slate-700">${t.mfeR==null?'–':'+'+t.mfeR+' R'}</td>
                    <td class="p-3 text-rose-500">${t.maeR==null?'–':t.maeR+' R'}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded ${t.discipline === 'NONE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'} font-semibold">${cbEsc(t.discipline)}</span></td>
                </tr>`;}
function drawJournalSpark(e){let canvas=$('ws-spark');if(!canvas){canvas=document.createElement('canvas');canvas.id='ws-spark';canvas.height=44;canvas.className='w-full';$('workspace-table-body').closest('table').parentElement.before(canvas);}canvas.setAttribute('aria-label','Đường cong R: '+e.length+' điểm, hiển thị tối đa 1200 điểm; chỉ số tính đủ dữ liệu');const w=canvas.width=canvas.clientWidth||600,ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,44);if(e.length<2)return;let min=0,max=0;for(const n of e){min=Math.min(min,n);max=Math.max(max,n);}const stride=Math.max(1,Math.ceil((e.length-1)/1199)),y=v=>40-(v-min)/(max-min||1)*36;ctx.beginPath();for(let i=0;i<e.length;i+=stride)ctx[i?'lineTo':'moveTo'](i/(e.length-1)*(w-4)+2,y(e[i]));ctx.lineTo(w-2,y(e.at(-1)));ctx.strokeStyle=e.at(-1)>=0?'#10b981':'#f43f5e';ctx.lineWidth=2;ctx.stroke();}
const WorkspaceWindow={
 rows:[],viewport:null,start:0,end:0,pending:false,key:null,
 mount(rows){const body=$('workspace-table-body'),table=body.closest('table'),viewport=table.parentElement,key=FILTER_FIELDS.map(id=>$(id)?.value||'').join('|')+'|'+JSON.stringify(SORT)+'|'+journalColumnGroup;this.rows=rows;this.viewport=viewport;viewport.id='journal-viewport';viewport.classList.add('journal-virtual-viewport');table.classList.add('journal-virtual-table');table.setAttribute('aria-rowcount',String(rows.length+1));viewport.tabIndex=0;viewport.setAttribute('aria-label','Nhật ký cuộn ảo; cuộn để xem toàn bộ lệnh');if(this.key!==key){viewport.scrollTop=0;this.key=key;}let pager=$('journal-pager');if(!pager){pager=document.createElement('div');pager.id='journal-pager';pager.className='text-xs p-2';viewport.after(pager);}pager.textContent='Cuộn toàn bộ '+rows.length.toLocaleString('vi-VN')+' lệnh · ▲ Lãi · ▼ Lỗ · ● Hòa · ○ Chưa xác minh · Enter / nhấp đúp để sửa';viewport.onscroll=()=>{if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;const input=body.querySelector('.ie');if(input)input.blur();this.paint();});};this.paint();drawJournalSpark(RiskStore.read().journal.curve);},
 detach(){if(this.viewport){this.viewport.classList.remove('journal-virtual-viewport');this.viewport.onscroll=null;this.viewport.querySelector('table')?.classList.remove('journal-virtual-table');this.viewport.querySelector('table')?.removeAttribute('aria-rowcount');this.viewport=null;this.key=null;}},
 paint(){if(!this.viewport)return;const range=JournalWindow.range(this.rows.length,Math.max(0,this.viewport.scrollTop-40),this.viewport.clientHeight||560,44),rows=this.rows.slice(range.start,range.end),body=$('workspace-table-body');this.start=range.start;this.end=range.end;if(journalColumnGroup!=='basic')renderJournalColumns(rows);else{restoreJournalHeader();body.innerHTML=rows.map(workspaceRowHtml).join('');[...body.rows].forEach((tr,i)=>{tr.dataset.id=rows[i].id;[...tr.cells].forEach((cell,j)=>{if(EK[j]){cell.tabIndex=0;cell.title='Nhấp đúp hoặc Enter để sửa';}});});const heads=body.closest('table').querySelectorAll('th');heads.forEach((h,i)=>{h.style.cursor='pointer';h.onclick=()=>{SORT={k:KEYS[i],d:SORT.k===KEYS[i]?-SORT.d:1};renderWorkspaceTable(this.rows);};});}for(const [i,tr] of [...body.rows].entries())tr.setAttribute('aria-rowindex',String(range.start+i+2));const spacer=height=>'<tr aria-hidden="true" role="presentation"><td colspan="11" style="height:'+height+'px;padding:0;border:0;line-height:0"></td></tr>';if(range.top)body.insertAdjacentHTML('afterbegin',spacer(range.top));if(range.bottom)body.insertAdjacentHTML('beforeend',spacer(range.bottom));},
};
function renderWorkspaceTable(trades) {if(SORT.k)trades=trades.slice().sort((x,y)=>{const u=SORT.k==='realizedR'?netR(x):x[SORT.k],v=SORT.k==='realizedR'?netR(y):y[SORT.k];return(u==null)-(v==null)||(u<v?-1:u>v?1:0)*SORT.d;});if(trades.length>1000){WorkspaceWindow.mount(trades);return;}WorkspaceWindow.detach();const all=trades,total=trades.length,maxPage=Math.max(0,Math.ceil(total/journalPageSize)-1);journalPage=Math.min(journalPage,maxPage);let pager=$('journal-pager');if(!pager){pager=document.createElement('div');pager.id='journal-pager';pager.className='flex items-center gap-3 text-xs p-2';$('workspace-table-body').closest('table').parentElement.after(pager);}pager.replaceChildren();for(const [label,delta] of [['Trang trước',-1],['Trang sau',1]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=delta<0?journalPage===0:journalPage===maxPage;b.onclick=()=>{journalPage+=delta;renderWorkspaceTable(all);};pager.append(b);}pager.append(document.createTextNode('Trang '+(journalPage+1)+'/'+(maxPage+1)+' · '+total.toLocaleString('vi-VN')+' lệnh'));trades=trades.slice(journalPage*journalPageSize,(journalPage+1)*journalPageSize);if(journalColumnGroup!=='basic'){renderJournalColumns(trades);return;}restoreJournalHeader();let a=trades.slice();if(SORT.k)a.sort((x,y)=>{const u=SORT.k==='realizedR'?netR(x):x[SORT.k],v=SORT.k==='realizedR'?netR(y):y[SORT.k];return(u==null)-(v==null)||(u<v?-1:u>v?1:0)*SORT.d;});
            const tbody = document.getElementById('workspace-table-body');
            let html = '';

            a.forEach(t=>{html+=workspaceRowHtml(t);});

            if (trades.length === 0) {
                html = `<tr><td colspan="11" class="p-4 text-center text-slate-400">Không tìm thấy giao dịch thỏa mãn bộ lọc.</td></tr>`;
            }

            tbody.innerHTML = html;
        [...$('workspace-table-body').rows].forEach((r,i)=>{if(a[i])r.dataset.id=a[i].id;});document.querySelectorAll('#workspace-table-body')[0].closest('table').querySelectorAll('th').forEach((h,i)=>{h.style.cursor='pointer';h.title='Bấm để sắp xếp';h.textContent=h.textContent.replace(/ [▲▼]$/,'')+(SORT.k===KEYS[i]?(SORT.d>0?' ▲':' ▼'):'');h.onclick=()=>{SORT={k:KEYS[i],d:SORT.k===KEYS[i]?-SORT.d:1};renderWorkspaceTable(all);};});
[...$('workspace-table-body').rows].forEach(row=>{if(row.dataset.id)[...row.cells].forEach((cell,i)=>{if(EK[i]){cell.tabIndex=0;cell.title='Nhấp đúp hoặc Enter để sửa';}});});drawJournalSpark(RiskStore.read().journal.curve);}
function renderMfeChart(trades) {
            const ctx = document.getElementById('chart-mfe').getContext('2d');
            if (charts.mfe) charts.mfe.destroy();

            const pts = trades.filter(t => typeof t.mfeR === 'number'&&Number.isFinite(netR(t))).map(t => ({ x: t.mfeR, y: netR(t), sym: t.symbol }));
            charts.mfe=ChartRegistry.draw('mfe',ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        data: pts,
                        backgroundColor: pts.map(p => p.y >= 0 ? '#10b981' : '#f43f5e'),
                        pointRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { title: { display: true, text: 'MFE (R)', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                        y: { title: { display: true, text: 'Realized R', font: { size: 10 } }, grid: { color: '#f1f5f9' } }
                    }
                }
            });
        }
function renderMaeChart(trades) {
            const ctx = document.getElementById('chart-mae').getContext('2d');
            if (charts.mae) charts.mae.destroy();

            const pts = trades.filter(t => typeof t.maeR === 'number'&&Number.isFinite(netR(t))).map(t => ({ x: Math.abs(t.maeR), y: netR(t), sym: t.symbol }));
            charts.mae=ChartRegistry.draw('mae',ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        data: pts,
                        backgroundColor: pts.map(p => p.y >= 0 ? '#2563eb' : '#f43f5e'),
                        pointRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { title: { display: true, text: 'MAE (R)', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                        y: { title: { display: true, text: 'Realized R', font: { size: 10 } }, grid: { color: '#f1f5f9' } }
                    }
                }
            });
        }
function renderRDistChart(rValues) {
            const ctx = document.getElementById('chart-rdist').getContext('2d');
            if (charts.rdist) charts.rdist.destroy();

            const bins = { '< -1R': 0, '-1R..0R': 0, '0R..1R': 0, '1R..3R': 0, '> 3R': 0 };
            rValues.forEach(r => {
                if (r < -1.05) bins['< -1R']++;
                else if (r < 0) bins['-1R..0R']++;
                else if (r <= 1.0) bins['0R..1R']++;
                else if (r <= 3.0) bins['1R..3R']++;
                else bins['> 3R']++;
            });

            charts.rdist=ChartRegistry.draw('rdist',ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(bins),
                    datasets: [{
                        data: Object.values(bins),
                        backgroundColor: ['#e11d48', '#fb7185', '#93c5fd', '#3b82f6', '#10b981'],
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
function renderDrawdownChart(rValues) {
            const ctx = document.getElementById('chart-drawdown').getContext('2d');
            if (charts.drawdown) charts.drawdown.destroy();

            const pts=[0,...RiskStore.read().journal.underwater.map(x=>-x)];
charts.drawdown=ChartRegistry.draw('drawdown',ctx, {
                type: 'line',
                data: {
                    labels: pts.map((_, i) => `#${i}`),
                    datasets: [{
                        data: pts,
                        borderColor: '#f43f5e',
                        backgroundColor: 'rgba(244, 63, 94, 0.1)',
                        fill: true,
                        tension: 0.2,
                        pointRadius: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { title: { display: true, text: 'Drawdown (R)', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
function bootstrapCI(arr){const view=RiskStore.read();return arr.length>2000||arr===view.edge.returns?view.journal.ci:RiskMath.bootstrapCI(arr);}
function sqnLabel(v){return v<1.6?'yếu':v<2?'dưới trung bình':v<2.5?'trung bình':v<3?'tốt':v<5.1?'rất tốt':'xuất sắc';}
function groupStats(arr){if(arr===lastDataset){const s=RiskStore.read();return {n:s.edge.n,win:s.edge.n?s.edge.winrate:0,exp:s.edge.expectancy,tot:s.journal.sumR,pf:s.edge.profitFactor};}return RiskMath.groupStats(arr.map(netR).filter(Number.isFinite));}
function renderConfidence(adj,sqn){
            const n=adj.length,ci=bootstrapCI(adj),spans0=!ci||(ci[0]<=0&&ci[1]>=0);
            const tones={emerald:'bg-emerald-50 border-emerald-200 text-emerald-900',amber:'bg-amber-50 border-amber-200 text-amber-900',rose:'bg-rose-50 border-rose-200 text-rose-900'};
            let tone='emerald',msg='Mẫu đủ lớn và khoảng tin cậy nằm hẳn phía dương: lợi thế có cơ sở thống kê.';
            if(ci&&ci[1]<0){tone='rose';msg='Khoảng tin cậy nằm hẳn phía âm: hệ thống đang mất tiền một cách có hệ thống.';}
            else if(n<30||spans0){tone='amber';msg=(n<30?'Mẫu nhỏ ('+n+' < 30 lệnh). ':'')+(spans0?'Khoảng tin cậy chứa 0 R nên chưa chứng minh được lợi thế. ':'')+'Chưa nên dùng các chỉ số này để đổi chiến lược.';}
            const el=document.getElementById('confidence-bar');el.className='rounded-xl border px-4 py-3 text-xs leading-relaxed '+tones[tone];
            el.innerHTML='<b>N = '+n+' lệnh</b> · Expectancy khoảng tin cậy 95%: '+(ci?fmtR(ci[0])+' → '+fmtR(ci[1]):'–')+' · SQN: '+(sqn==null?'–':sqn.toFixed(2)+' ('+sqnLabel(sqn)+')')+'<div class="mt-1">'+msg+'</div>';
        }
function renderDisciplineCost(){
            const c=document.getElementById('discipline-cost'),ok=lastDataset.filter(t=>t.discipline==='NONE'&&Number.isFinite(netR(t))),bad=lastDataset.filter(t=>t.discipline!=='NONE'&&Number.isFinite(netR(t)));
            if(!bad.length){c.innerHTML='<p class="text-xs text-slate-500">Không có lệnh vi phạm kỷ luật trong bộ lọc hiện tại.</p>';return;}
            const a=ok.length?groupStats(ok):null,b=groupStats(bad),all=groupStats(lastDataset);
            const card=(t,v,sub)=>'<div class="rounded-lg border border-slate-200 p-3"><div class="text-xs text-slate-500">'+t+'</div><div class="text-lg font-bold tabular-nums '+(v<0?'text-rose-600':'text-slate-900')+'">'+fmtR(v)+'</div><div class="text-xs text-slate-500">'+sub+'</div></div>';
            c.innerHTML='<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">'
                +card('Đúng kế hoạch · expectancy',a?a.exp:null,(a?a.n:0)+' lệnh')
                +card('Vi phạm kỷ luật · expectancy',b.exp,b.n+' lệnh, tổng '+fmtR(b.tot))
                +card('Nếu bỏ lệnh vi phạm · expectancy',a?a.exp:null,'hiện tại '+fmtR(all.exp)+', chênh tổng '+fmtR(-b.tot))+'</div>';
        }
function renderBreakdown(){const d=$('breakdown-dim').value,g={},c=$('breakdown-container'),a=state.extra.avg;lastDataset.forEach(t=>{const k=BK(t,d);(g[k]=g[k]||[]).push(t);});let rows=Object.keys(g).map(k=>Object.assign({k},groupStats(g[k])));rows.sort(/^h\d|hour|weekday/.test(d)?(x,y)=>x.k<y.k?-1:1:(x,y)=>a?y.exp-x.exp:y.tot-x.tot);const th=(t,l)=>'<th class="py-2 '+(l?'pr-3':'px-3 text-right')+' font-semibold">'+t+'</th>';let h='<table class="w-full text-xs border-collapse"><thead><tr class="text-left text-slate-500 border-b border-slate-200">'+th('Nhóm',1)+th('Số lệnh')+th('Tỷ lệ thắng')+th('R trung bình'+(a?' ▼':''))+th('PF')+th('Tổng R'+(a?'':' ▼'))+'</tr></thead><tbody>';rows.forEach(r=>{const s=r.n<5,col=r.exp>0?'text-emerald-700':r.exp<0?'text-rose-700':'';h+='<tr class="border-b border-slate-100 tabular-nums'+(s?' text-slate-400':'')+'"><td class="py-2 pr-3 font-medium">'+E(d==='discipline'?(DISC_LABEL[r.k]||r.k):r.k)+(s?' <span class="text-xs">(mẫu nhỏ)</span>':'')+'</td><td class="text-right px-3">'+r.n+'</td><td class="text-right px-3">'+(r.win*100).toFixed(0)+'%</td><td class="text-right px-3 '+col+(a?' font-bold':'')+'">'+fmtR(r.exp)+'</td><td class="text-right px-3">'+(isFinite(r.pf)?r.pf.toFixed(2):'∞')+'</td><td class="text-right pl-3 '+col+(a?'':' font-bold')+'">'+fmtR(r.tot)+'</td></tr>';});c.innerHTML=h+'</tbody></table>';}
function renderHeatmap(trades) {
            const c=document.getElementById('heatmap-container');
            const hours=[...new Set(trades.map(t=>t.hour))].sort();
            const days=['T2','T3','T4','T5','T6'].concat(['T7','CN'].filter(d=>trades.some(t=>t.weekday===d)));
            let h='<table class="w-full text-center border-collapse text-xs"><thead><tr><th class="p-2 border border-slate-200 bg-slate-100 font-semibold">Giờ \\ Thứ</th>';
            days.forEach(d=>{h+='<th class="p-2 border border-slate-200 bg-slate-100 font-semibold">'+d+'</th>';});
            h+='</tr></thead><tbody>';
            hours.forEach(hr=>{
                h+='<tr><td class="p-2 border border-slate-200 bg-slate-50 font-bold text-slate-700">'+hr+'</td>';
                days.forEach(d=>{
                    const m=trades.filter(t=>t.weekday===d&&t.hour===hr),n=m.length,val=n?sumOf(m.map(netR))/n:0;
                    let bg='bg-slate-50 text-slate-400';
                    if(n){bg=val>2?'bg-emerald-600 text-white font-bold':val>0?'bg-emerald-100 text-emerald-900 font-medium':'bg-rose-100 text-rose-900 font-medium';}
                    h+='<td title="'+n+' lệnh" class="p-2.5 border border-slate-200 '+bg+(n&&n<3?' opacity-60':'')+' tabular-nums">'+(n?(val>0?'+':'')+val.toFixed(1)+'R<span class="block text-xs opacity-80">n='+n+'</span>':'-')+'</td>';
                });
                h+='</tr>';
            });
            c.innerHTML=h+'</tbody></table><p class="text-xs text-slate-500 mt-2">Giá trị là trung bình R của các lệnh trong ô. Ô mờ có dưới 3 lệnh nên chưa đủ để kết luận.</p>';
        }
function renderDictionaryCards() {
            const container = document.getElementById('dict-cards-container');
            let html = '';

            Object.keys(dictionary).forEach(key => {
                const item = dictionary[key];
                html += `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <div class="flex items-center justify-between">
                        <h3 class="font-bold text-sm text-slate-900">${item.title}</h3>
                        <span class="text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold">V6 Standard</span>
                    </div>
                    <p class="text-xs text-slate-600">${item.function}</p>
                    <div class="bg-slate-900 text-emerald-400 p-2 rounded font-mono text-xs">${item.formula}</div>
                    <button onclick="openTooltipModal('${key}')" class="text-xs text-brand-600 hover:underline font-semibold flex items-center gap-1">
                        Xem Thang Điểm & Action Plan →
                    </button>
                </div>`;
            });

            container.innerHTML = html;
        }
function searchDictionary() {
            const q = document.getElementById('dict-search').value.toLowerCase();
            const cards = document.getElementById('dict-cards-container').children;
            Array.from(cards).forEach(c => {
                c.style.display = c.textContent.toLowerCase().includes(q) ? 'block' : 'none';
            });
        }
function openTooltipModal(key) {
            const item = dictionary[key];
            if (!item) return;

            document.getElementById('modal-title').textContent = item.title;
            document.getElementById('modal-function').textContent = item.function;
            document.getElementById('modal-formula').textContent = item.formula;
            document.getElementById('modal-scale').innerHTML = item.scale;
            document.getElementById('modal-action').textContent = item.action;

            document.getElementById('tooltip-modal').classList.remove('hidden');
        }
function closeTooltipModal() {
            document.getElementById('tooltip-modal').classList.add('hidden');
        }
function runMappingDemo(market) {
            const tbody = document.getElementById('mapping-demo-body');
            let row = {};

            if (market === 'STOCKS') {
                row = { id: 'TRD-201', raw: 'FPT: Buy 1000 @ 135, Sell @ 142', mkt: 'STOCKS', pnl: '+$7,000 (161,000,000 VNĐ)', sl: 'Khuyết SL (Fallback 1R=$100)', r: '+70.0 R', status: 'Mapped Bi-directional' };
            } else if (market === 'FOREX') {
                row = { id: 'TRD-202', raw: 'EURUSD: Buy 1.0 Lot @ 1.0850, SL 1.0820', mkt: 'FOREX_CFD', pnl: '+$300', sl: 'SL 30 Pips ($300 = 1R)', r: '+1.0 R', status: 'Mapped Bi-directional' };
            } else if (market === 'FUTURES') {
                row = { id: 'TRD-203', raw: 'VN30F1M: Short 2 HD @ 1250, Exit @ 1240', mkt: 'FUTURES', pnl: '+$2,000,000 VNĐ', sl: 'SL 5 điểm ($100 = 1R)', r: '+0.8 R', status: 'Mapped Bi-directional' };
            } else if (market === 'CRYPTO') {
                row = { id: 'TRD-204', raw: 'BTCUSDT: Long 0.5 BTC @ 65000, Exit @ 68000', mkt: 'CRYPTO', pnl: '+$1,500', sl: 'SL 64000 ($500 = 1R)', r: '+3.0 R', status: 'Mapped Bi-directional' };
            }

            tbody.innerHTML = `
            <tr class="bg-blue-50/50">
                <td class="p-2.5 font-bold text-slate-900">${row.id}</td>
                <td class="p-2.5 font-mono text-slate-700">${row.raw}</td>
                <td class="p-2.5"><span class="px-2 py-0.5 rounded bg-slate-900 text-white font-bold">${row.mkt}</span></td>
                <td class="p-2.5 font-bold text-emerald-600">${row.pnl}</td>
                <td class="p-2.5 text-slate-600">${row.sl}</td>
                <td class="p-2.5 font-bold text-brand-700">${row.r}</td>
                <td class="p-2.5"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">${row.status}</span></td>
            </tr>`;
        }
function ed(td){if(journalColumnGroup!=='basic'){const id=td.parentElement.dataset.id;if(id)editorOpen(id);return;}const tr=td.parentElement,t=state.trades.find(x=>String(x.id)===tr.dataset.id),k=EK[td.cellIndex];if(!t||!k||td.querySelector('.ie'))return;const o=OP[k],nm=NK.includes(k),el=document.createElement(o?'select':'input');el.className='ie border border-brand-500 rounded px-1 py-0.5 text-xs w-24 bg-white text-slate-900';if(o){o.forEach(x=>el.add(new Option(x,x)));el.value=t[k];}else{el.type=k==='date'?'date':nm?'number':'text';el.step='any';el.value=t[k]==null?'':t[k];}td.textContent='';td.appendChild(el);el.focus();let done=0;
const fin=ok=>{if(done)return;done=1;if(!ok)return updateFilters();let v=el.value;if(nm){v=v===''?null:+v;if((v!=null&&!isFinite(v))||(k==='netPnl'&&v==null)||(k==='initialRisk'&&!(v>0))){toast('Giá trị không hợp lệ');return updateFilters();}}else if(k==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){toast('Ngày không hợp lệ');return updateFilters();}}else{v=v.trim();if(!v)return updateFilters();if(k==='symbol')v=v.toUpperCase();}
if(UnifiedJournal.stable(state.trades.find(x=>String(x.id)===tr.dataset.id))!==UnifiedJournal.stable(t)){toast('Lệnh đã đổi ở nơi khác; giữ dữ liệu đã nhập để đối chiếu');done=0;return;}if(!writeData(d=>{let row=d.trades.find(x=>String(x.id)===tr.dataset.id);Object.assign(row,JournalForm.invalidate(row,k));const t=row;t[k]=v;if(k==='initialRisk'){t.riskEstimated=false;t.riskSource='MANUAL';}if(k==='date')t.weekday=weekdayOf(v);if(k==='netPnl'||k==='initialRisk')t.realizedR=t.initialRisk>0?t.netPnl/t.initialRisk:null;}))return updateFilters();updateFilters();};
el.onblur=()=>fin(1);el.onkeydown=e=>{if(e.key==='Enter')fin(1);if(e.key==='Escape')fin(0);};}
function renderGameplan(){const p=plan();$('gp-out').innerHTML=p.d?'R:R = <b>1 : '+p.rr.toFixed(2)+'</b> · Khối lượng = <b>'+p.size.toFixed(4).replace(/\.?0+$/,'')+'</b> đơn vị (rủi ro '+usd(p.r)+')':'Nhập Entry và Stop Loss để tính R:R và khối lượng.';$('gp-list').innerHTML=state.extra.plans.map((q,i)=>'<div class="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg p-2"><b>'+E(q.y)+'</b> '+q.d+' · '+E(q.u||'')+' · E '+q.e+' / SL '+q.s+' / TP '+(q.t||'–')+' · R:R '+q.rr.toFixed(2)+' · KL '+q.size.toFixed(2)+'<button data-i="'+i+'" class="gp-go ml-auto '+B+'">Chuyển thành lệnh thực</button><button data-i="'+i+'" class="gp-x text-rose-600 text-xs font-semibold">Xóa</button></div>').join('')||'<span class="text-slate-400">Chưa có kế hoạch.</span>';}
function renderCalendar(){CM=CM||(state.trades.map(t=>t.date).sort().pop()||todayISO()).slice(0,7);const[y,m]=CM.split('-').map(Number),off=(new Date(y,m-1,1).getDay()+6)%7,wk=Math.ceil((off+new Date(y,m,0).getDate())/7);$('cal-t').textContent='Tháng '+m+'/'+y;let h=['T2','T3','T4','T5','T6','T7','CN','Tổng tuần'].map(x=>'<div class="font-semibold text-slate-500 text-center">'+x+'</div>').join('');for(let w=0;w<wk;w++){let tp=0,tn=0;for(let d=0;d<7;d++){const dt=new Date(y,m-1,1-off+w*7+d),k=ymd(dt),ts=state.trades.filter(t=>t.date===k),p=sumOf(ts.map(t=>t.netPnl));tp+=p;tn+=ts.length;h+='<div class="border border-slate-200 rounded-lg p-1.5 min-h-[56px] '+(dt.getMonth()!==m-1?'opacity-40 ':'')+(ts.length?(p>=0?'bg-emerald-50':'bg-rose-50'):'')+'"><div class="text-slate-500">'+dt.getDate()+'</div>'+(ts.length?'<div class="font-bold tabular-nums '+(p>=0?'text-emerald-700':'text-rose-700')+'">'+usd(p)+'</div><div class="text-slate-500">'+ts.length+' lệnh</div>':'')+'</div>';}h+='<div class="border border-slate-300 rounded-lg p-1.5 bg-slate-100 font-semibold tabular-nums '+(tp<0?'text-rose-700':'')+'">'+usd(tp)+'<div class="font-normal text-slate-500">'+tn+' lệnh</div></div>';}$('cal-g').innerHTML=h;}
function renderReview(){if(!$('rv-w').value)$('rv-w').value=wkOf(new Date());const n=state.extra.notes[$('rv-w').value]||{};RV.forEach(r=>$('rv-'+r[0]).value=n[r[0]]||'');const ts=state.trades.filter(t=>wkOf(new Date(t.date+'T00:00:00'))===$('rv-w').value);$('rv-s').textContent='Tuần này có '+ts.length+' lệnh, tổng '+fmtR(sumOf(ts.map(netR)))+'.';}
function renderChartbook(){$('cb-g').innerHTML=state.extra.book.map((b,i)=>'<figure class="border border-slate-200 rounded-lg p-1"><img src="'+b.img+'" alt="Mẫu '+E(b.u)+'" class="w-full rounded"><figcaption class="text-xs flex justify-between p-1"><b>'+E(b.u||'Chưa gắn setup')+'</b><button data-i="'+i+'" class="text-rose-600">Xóa</button></figcaption></figure>').join('')||'<span class="text-xs text-slate-400">Chưa có ảnh.</span>';}
function renderChecklist(){const l=$('ck-l');if(!l.dataset.k||l.dataset.k!==state.extra.chk.join('|')){l.dataset.k=state.extra.chk.join('|');l.innerHTML=state.extra.chk.map((c,i)=>'<label class="flex items-center gap-2"><input type="checkbox" class="ck-c"> <span class="flex-1">'+E(c)+'</span><button data-i="'+i+'" class="ck-x text-rose-600 text-xs">Xóa</button></label>').join('');}const all=[...document.querySelectorAll('.ck-c')];$('ck-r').innerHTML=all.length&&all.every(c=>c.checked)?'<span class="text-emerald-700">✔ Được phép vào lệnh</span>':'<span class="text-amber-700">Chưa đủ điều kiện, chưa nên vào lệnh ('+all.filter(c=>c.checked).length+'/'+all.length+')</span>';}
function parse(txt){const L=txt.trim().split(/\r?\n/).filter(x=>x.trim());if(L.length<2)return{err:'Cần dòng tiêu đề và ít nhất 1 dòng dữ liệu.'};const dl=/\t/.test(L[0])?'\t':/;/.test(L[0])?';':',',H=L[0].split(dl).map(x=>x.trim().toLowerCase()),c=re=>H.findIndex(h=>re.test(h)),C={d:c(/date|ngày|time|thời gian/),s:c(/symbol|mã|ticker|item/),y:c(/type|side|chiều|loại/),v:c(/volume|size|khối|qty|lots/),e:c(/entry|open|giá vào/),x:c(/exit|close|giá ra/),p:c(/profit|lãi|p&l|pnl/),sl:c(/s\/l|^sl|stop/),hi:c(/high|cao/),lo:c(/low|thấp/)};if(C.d<0||C.s<0||C.y<0||C.p<0)return{err:'Thiếu cột bắt buộc: ngày, mã, chiều (mua/bán), lãi/lỗ.'};const g={};let bad=0;L.slice(1).forEach(l=>{const a=l.split(dl),ds=(a[C.d]||'').trim();let m=ds.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/),dd;if(m)dd=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');else if((m=ds.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)))dd=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');const p=num(a[C.p]);if(!dd||!isFinite(p)){bad++;return;}const tm=ds.match(/(\d{1,2}):\d{2}/),sy=(a[C.s]||'').trim().toUpperCase(),sd=/sell|short|bán/i.test(a[C.y])?'Short':'Long',k=dd+'|'+sy+'|'+sd,v=C.v<0?1:(num(a[C.v])||1),e=C.e<0?NaN:num(a[C.e]),o=g[k]=g[k]||{dd,sy,sd,p:0,v:0,ev:0,n:0,sl:NaN,hi:-Infinity,lo:Infinity,h:tm?tm[1].padStart(2,'0')+':00':'00:00'};o.p+=p;o.v+=v;o.ev+=(isFinite(e)?e:0)*v;o.n++;if(C.sl>=0&&isFinite(num(a[C.sl]))&&num(a[C.sl])>0)o.sl=num(a[C.sl]);if(C.hi>=0&&isFinite(num(a[C.hi])))o.hi=Math.max(o.hi,num(a[C.hi]));if(C.lo>=0&&isFinite(num(a[C.lo])))o.lo=Math.min(o.lo,num(a[C.lo]));});let merged=0,miss=0;const rows=Object.values(g).map((o,i)=>{merged+=o.n-1;const e=o.ev/o.v,mu=mk(o.sy)==='FOREX_CFD'?(/^XA[UG]/.test(o.sy)?100:1e5):1,vv=o.v*mu;let risk=isFinite(o.sl)&&e?Math.abs(e-o.sl)*vv:0;const ok=risk>0&&Math.abs(o.p/risk)<=50;if(!ok)risk=NaN;const t={id:Date.now()+i,date:o.dd,symbol:o.sy,market:mk(o.sy),side:o.sd,setup:'Import',netPnl:Math.round(o.p*100)/100,initialRisk:ok?Math.round(risk*100)/100:null,realizedR:ok?+(o.p/risk).toFixed(2):null,hour:o.h,weekday:weekdayOf(o.dd),discipline:'NONE',review:'PENDING',tag:'IMPORT',riskEstimated:true,riskSource:ok?'INFERRED_CONTRACT':'MISSING_SL'};if(ok&&isFinite(e)&&isFinite(o.hi)&&isFinite(o.lo)&&o.hi>-Infinity&&o.lo<Infinity){const L=o.sd==='Long';t.mfeR=+(((L?o.hi-e:e-o.lo)*vv)/risk).toFixed(2);t.maeR=-Math.abs(Math.min(0,+(((L?o.lo-e:e-o.hi)*vv)/risk).toFixed(2)));}else miss++;return t;});return{rows,merged,miss,bad};}
function kApply(){const o=ord();o.forEach(i=>{kg.appendChild(cd[i]);cd[i].classList.toggle('hidden',state.ext2.hide.includes(i));cd[i].draggable=true;cd[i].dataset.k=i;});$('kcfg-l').innerHTML=o.map(i=>'<span class="inline-flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 bg-white"><label class="flex items-center gap-1"><input type="checkbox" class="kc-v" data-k="'+i+'"'+(state.ext2.hide.includes(i)?'':' checked')+'> '+KN[KI.indexOf(i)]+'</label><button class="kc-m px-1" data-k="'+i+'" data-d="-1" aria-label="Chuyển lên trước">◀</button><button class="kc-m px-1" data-k="'+i+'" data-d="1" aria-label="Chuyển ra sau">▶</button></span>').join('');}
function bindSourceEvents(){document.addEventListener('mouseover',e=>{const b=tipBtn(e);if(!b)return;clearTimeout(tipTimer);tipTimer=setTimeout(()=>{if(!tipPinned)showTip(b,false);},150);});
document.addEventListener('mouseout',e=>{if(!tipBtn(e))return;clearTimeout(tipTimer);hideTip(false);});
document.addEventListener('click',e=>{const b=tipBtn(e);if(b){e.preventDefault();e.stopImmediatePropagation();showTip(b,true);return;}if(!e.target.closest('#tip-pop'))hideTip(true);},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip(true);});
$('tab-gameplan').addEventListener('input',()=>renderGameplan());
$('gp-save').onclick=()=>{if(!allowNewTrade())return;const p=plan(),y=$('gp-y').value.trim().toUpperCase();if(!y||!p.d)return toast('Cần mã, Entry và Stop Loss khác nhau');if(!writeData(d=>d.extra.plans.push(Object.assign(p,{y,d:$('gp-d').value,u:$('gp-u').value}))))return;renderGameplan();};
$('gp-list').onclick=e=>{const i=e.target.dataset.i,q=state.extra.plans[i];if(!q)return;if(e.target.classList.contains('gp-x')){writeData(d=>d.extra.plans.splice(i,1));return renderGameplan();}if(!allowNewTrade())return;const x=parseFloat(prompt('Giá thoát thực tế của '+q.y+'?'));if(!isFinite(x))return;const dir=q.d==='Long'?1:-1,R=(x-q.e)*dir/Math.abs(q.e-q.s),h=String(new Date().getHours()).padStart(2,'0')+':00';writeData(d=>{d.trades.push({id:Date.now(),date:todayISO(),symbol:q.y,market:mk(q.y),side:q.d,setup:q.u||'Kế hoạch',netPnl:Math.round(R*q.r*100)/100,initialRisk:q.r,realizedR:+R.toFixed(2),hour:h,weekday:weekdayOf(todayISO()),discipline:'NONE',review:'PENDING',tag:'PLAN'});d.extra.plans.splice(i,1);});renderGameplan();toast('Đã thêm lệnh vào nhật ký');};
$('cal-p').onclick=()=>shift(-1);
$('cal-n').onclick=()=>shift(1);
$('rv-w').onchange=()=>renderReview();
RV.forEach(r=>$('rv-'+r[0]).oninput=()=>{const w=$('rv-w').value;writeData(d=>{d.extra.notes[w]=d.extra.notes[w]||{};d.extra.notes[w][r[0]]=$('rv-'+r[0]).value;});});
$('cb-f').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>6e5)return toast('Ảnh quá lớn, hãy nén dưới 600 KB');const r=new FileReader();r.onload=()=>{writeData(d=>d.extra.book.push({u:$('cb-u').value.trim(),img:r.result}));renderChartbook();};r.readAsDataURL(f);e.target.value='';};
$('cb-g').onclick=async e=>{if(e.target.tagName==='BUTTON'){try{await LifecycleUI.backup();writeData(d=>d.extra.book.splice(+e.target.dataset.i,1));renderChartbook();}catch(error){toast(error.message);}}};
$('ck-a').onclick=()=>{const v=$('ck-n').value.trim();if(v){writeData(d=>d.extra.chk.push(v));$('ck-n').value='';renderChecklist();}};
$('ck-l').onclick=e=>{if(e.target.classList.contains('ck-x')){e.preventDefault();writeData(d=>d.extra.chk.splice(+e.target.dataset.i,1));renderChecklist();}};
$('im-p').onclick=()=>{const r=parse($('im-t').value);if(r.err){$('im-o').textContent=r.err;return $('im-g').classList.add('hidden');}PR=r.rows;const mk={};PR.forEach(t=>mk[t.market]=(mk[t.market]||0)+1);$('im-o').innerHTML='Đọc được <b>'+PR.length+'</b> lệnh kinh tế (gộp '+r.merged+' dòng chốt từng phần'+(r.bad?', bỏ '+r.bad+' dòng lỗi':'')+'). Thị trường: '+Object.keys(mk).map(k=>k+' '+mk[k]).join(', ')+'. '+(r.miss?r.miss+' lệnh thiếu MAE/MFE nên chỉ bị loại khỏi hai biểu đồ MAE/MFE. ':'')+'1R nhập từ báo cáo là ước tính theo quy đổi giả định, luôn đánh dấu chưa xác minh; không lấy vào chỉ số Risk Pro cho đến khi người dùng xác nhận.';$('im-g').classList.toggle('hidden',!PR.length);};
$('im-g').onclick=()=>{const ex=new Set(state.trades.map(t=>[t.date,t.symbol,t.side,t.netPnl].join('|'))),add=PR.filter(t=>!ex.has([t.date,t.symbol,t.side,t.netPnl].join('|')));if(!writeData(d=>d.trades.push(...add)))return;$('im-g').classList.add('hidden');toast('Đã nhập '+add.length+' lệnh'+(PR.length>add.length?', bỏ '+(PR.length-add.length)+' lệnh trùng':''));};
KI.forEach(i=>cd[i]=$(i).closest('.rounded-xl'));kg=cd[KI[0]].parentElement;
kg.insertAdjacentHTML('afterbegin','<details id="kcfg" class="col-span-full text-xs"><summary class="cursor-pointer font-semibold text-slate-500">Tùy chỉnh thẻ KPI: ẩn/hiện và sắp xếp</summary><div id="kcfg-l" class="flex flex-wrap gap-2 mt-2"></div></details>');
const ord=()=>{const o=state.ext2.kpi.filter(i=>KI.includes(i));KI.forEach(i=>o.includes(i)||o.push(i));return o;};

const mv=(i,d)=>{const o=ord(),p=o.indexOf(i),q=Math.max(0,Math.min(o.length-1,p+d));o.splice(p,1);o.splice(q,0,i);writeData(d=>d.ext2.kpi=o);kApply();};
$('kcfg').addEventListener('click',e=>{const b=e.target.closest('.kc-m');if(b)mv(b.dataset.k,+b.dataset.d);});
$('kcfg').addEventListener('change',e=>{const c=e.target.closest('.kc-v');if(!c)return;writeData(d=>d.ext2.hide=c.checked?d.ext2.hide.filter(x=>x!==c.dataset.k):d.ext2.hide.concat(c.dataset.k));kApply();});
let dk=null;kg.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('[data-k]');dk=c&&c.matches('.rounded-xl')?c.dataset.k:null;});
kg.addEventListener('dragover',e=>{if(dk)e.preventDefault();});
kg.addEventListener('drop',e=>{const c=e.target.closest('.rounded-xl[data-k]');if(!dk||!c||c.dataset.k===dk)return;e.preventDefault();const o=ord(),q=o.indexOf(c.dataset.k);o.splice(o.indexOf(dk),1);o.splice(q,0,dk);writeData(d=>d.ext2.kpi=o);dk=null;kApply();});
kApply();

document.addEventListener('click',e=>{const b=e.target.closest('.cb-ren');if(!b)return;e.preventDefault();e.stopPropagation();const c=cat(b),v=b.dataset.v,cur=cbPool(c).find(o=>o.v===v),n=prompt('Tên hiển thị mới (để trống = tên gốc):',cur?cur.l:v);if(n==null)return;writeData(d=>{const o=d.ext2.opt[c]=d.ext2.opt[c]||{};o[v]={...o[v],l:n.trim()||undefined};});cbRender(c);updateFilters();},true);
document.addEventListener('change',e=>{const i=e.target.closest&&e.target.closest('.cb-col');if(!i)return;const c=cat(i);writeData(d=>{const o=d.ext2.opt[c]=d.ext2.opt[c]||{};o[i.dataset.v]={...o[i.dataset.v],c:i.value};});cbRender(c);});
$('workspace-table-body').addEventListener('dblclick',e=>{const td=e.target.closest('td');if(td)ed(td);});$('workspace-table-body').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='TD')ed(e.target);});
$('custom-tags-container').addEventListener('click',e=>{const b=e.target.closest('button[data-option-cat]');if(b)removeCustomOption(b.dataset.optionCat,b.dataset.optionValue);});
$('tab-risktools').addEventListener('input',renderChecklist);$('breakdown-mode').value=state.extra.avg?'avg':'tot';$('breakdown-mode').onchange=()=>{writeData(d=>d.extra.avg=$('breakdown-mode').value==='avg');};document.querySelectorAll('[id^=f-]').forEach(el=>el.addEventListener('input',updateFilters));
$('risk-detail-close').onclick=editorClose;$('risk-detail-cancel').onclick=editorClose;$('risk-detail-save').onclick=submitNewTrade;document.addEventListener('keydown',e=>{if(e.key==='Escape')editorClose();});
$('display-unit').value=state.extra.unit;$('display-unit').onchange=()=>{let unit=$('display-unit').value;if(unit==='P*'||unit==='P'&&!state.ext2.set){const a=prompt('1R tương đương bao nhiêu pip/tick? Ví dụ: 20 Pips, 8 Ticks, 15 Điểm',state.ext2.pip+' '+state.ext2.pl),m=a&&a.match(/([\d.,]+)\s*(\S*)/);if(m&&+m[1].replace(',','.')>0){if(!writeData(d=>{d.ext2.set=1;d.ext2.pip=+m[1].replace(',','.');d.ext2.pl=m[2]||'Pips';d.extra.unit='P';}))return;}unit='P';}writeData(d=>d.extra.unit=unit);};
$('load-sample').onclick=()=>LifecycleUI.chooseDemo($('sample-source').value);}

function recalculateAndRender(activeTrades){
 lastDataset=activeTrades||state.trades;RiskStore.select(lastDataset.map(t=>String(t.id)));
 const view=RiskStore.read(),s=view.journal,N=view.edge.n,set=(id,v)=>$(id).textContent=v;
 if(!N){['kpi-expectancy','kpi-sqn','kpi-pf','kpi-exit-eff','kpi-dd','kpi-recovery'].forEach(id=>set(id,'–'));ChartRegistry.clear();const msg='<p class="text-xs text-slate-500 py-6 text-center">Không có lệnh nào khớp bộ lọc. Nới lỏng điều kiện hoặc bấm "Xóa bộ lọc".</p>';['confidence-bar','heatmap-container','discipline-cost','breakdown-container'].forEach(id=>$(id).innerHTML=msg);renderRiskRatios([]);renderHoldChart([]);renderSharedStatus();renderRiskHeader();return;}
 set('kpi-expectancy',fmtR(view.edge.expectancy));set('kpi-sqn',Number.isFinite(view.edge.sqn)?view.edge.sqn.toFixed(2):'–');set('kpi-pf',isFinite(view.edge.profitFactor)?view.edge.profitFactor.toFixed(2):'∞');set('kpi-exit-eff',s.avgExitEff==null?'–':s.avgExitEff.toFixed(1)+'%');set('kpi-dd',s.maxDDR>0?'-'+s.maxDDR.toFixed(2)+' R':'0.00 R');set('kpi-recovery',s.maxDDR>0?(s.sumR/s.maxDDR).toFixed(2):(s.sumR>0?'∞':'–'));
 if(state.trades.length>1000&&document.body.dataset.page==='workspace'){renderSharedStatus();renderRiskHeader();return;}
 const valid=lastDataset.filter(t=>RiskMath.validTrade(t,state.grossMode));renderMfeChart(valid);renderMaeChart(valid);renderRDistChart(view.edge.returns);renderDrawdownChart(view.edge.returns);renderHeatmap(valid);renderConfidence(view.edge.returns,Number.isFinite(view.edge.sqn)?view.edge.sqn:null);renderDisciplineCost();renderBreakdown();renderHoldChart(lastDataset);renderRiskRatios(lastDataset);renderSharedStatus();renderRiskHeader();
}
function updateSettingsFromUI(){const initial=state.extra.classicSync?.owner?state.initialCapital:Number($('setting-initial-cap').value),risk=Number($('setting-default-1r').value),friction=Number($('setting-friction').value);if(![initial,risk,friction].every(Number.isFinite)||initial<0||risk<0||friction<0){toast('Vốn, 1R và chi phí phải là số không âm');return;}writeData(d=>{d.initialCapital=initial;d.defaultRisk1R=risk;d.frictionCostR=friction;d.sqnCapEnabled=$('setting-sqn-cap').checked;d.extra.accountBaselineConfirmed=true;});syncSettingsUI();}
function initTheme(){applyTheme(state.extra.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));}
function toggleTheme(){const t=document.documentElement.classList.contains('dark')?'light':'dark';applyTheme(t);writeData(d=>d.extra.theme=t);}
function toggleGross(){if(!state.grossMode&&!state.trades.filter(t=>t.initialRisk>0).every(t=>Number.isFinite(t.grossPnl)||Number.isFinite(t.feeR))){toast('Chưa có Gross P&L hoặc phí cho tất cả giao dịch: không thể chuyển Gross R chính xác');return;}writeData(d=>d.grossMode=!d.grossMode);}
function exportBackup(){downloadJson('tuannhatky-unified.json',Core.backupText());}
async function importBackup(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;try{await restoreUnifiedText(await file.text());}catch(error){toast('File sao lưu không hợp lệ hoặc chưa thể sao lưu bản hiện tại: '+error.message);}}
function toggleMobileSidebar(){const el=$('sidebar');el.classList.toggle('hidden');}
function toggleSettingsDrawer(){syncRiskProfile();$('settings-drawer').classList.toggle('hidden');}

const AdaptiveTradeForm={
 current:null,
 enabled(){return !!$('p4-enabled')?.checked;},
 load(trade){this.current=JournalForm.load(trade,state.currency||'USD');if(!trade)this.current.asset_class=JournalForm.asset($('risk-edit-market')?.value);this.render();},
 render(){const d=this.current,host=$('asset-form-fields');host.innerHTML='<label class="flex gap-2 items-center mb-2"><input id="p4-enabled" type="checkbox"'+(d.enabled?' checked':'')+'> Dùng dữ liệu giá, khối lượng và chứng từ đã xác minh</label><p class="mb-2">Tài khoản '+E(state.currency||'USD')+' · 1R chỉ gồm rủi ro giá ban đầu, không gồm phí/thuế. Các ô P&L/1R nhập tay chỉ dùng khi đánh dấu đã đối soát.</p><div class="grid grid-cols-2 gap-3">'+JournalForm.fields.map(([key,label,kind])=>'<label>'+E(label)+(kind==='asset'?'<select data-p4="'+key+'" class="block border rounded p-2 w-full">'+Object.entries(JournalForm.profiles).map(([value,p])=>'<option value="'+value+'"'+(d[key]===value?' selected':'')+'>'+E(p.label)+'</option>').join('')+'</select>':'<input data-p4="'+key+'" type="'+kind+'" '+(kind==='number'?'step="any" ':'')+'value="'+E(d[key]??'')+'" class="block border rounded p-2 w-full">')+'</label>').join('')+'</div><div class="grid gap-2 mt-3">'+JournalForm.checks.map(([key,label])=>'<label class="flex gap-2"><input data-p4="'+key+'" type="checkbox"'+(d[key]?' checked':'')+'>'+E(label)+'</label>').join('')+'</div>';this.adapt();this.preview();},
 read(){const d={...this.current};for(const el of $('asset-form-fields').querySelectorAll('[data-p4]'))d[el.dataset.p4]=el.type==='checkbox'?el.checked:el.value;return {...d,id:editorId||'form-preview',date:editorId?state.trades.find(t=>String(t.id)===editorId)?.date||todayISO():$('risk-edit-open').value.slice(0,10)||todayISO(),origin:'USER_LIVE',symbol:$('risk-edit-symbol').value,direction:$('risk-edit-side').value==='Short'?'SHORT':'LONG',quantity:$('risk-edit-lots').value,entry_price:$('risk-edit-entry').value,exit_price:$('risk-edit-exit').value,stop_loss:$('risk-edit-sl').value,initial_1r_money:$('risk-edit-risk').value,net_pnl:$('risk-edit-pnl').value,account_ccy:state.currency||'USD'};},
 result(){return JournalForm.preview(this.read());},
 adapt(){const profile=JournalForm.profiles[this.read().asset_class];if(!profile)return;const input=$('risk-edit-lots');input.step=String(this.read().quantity_step||profile.step);input.min='0';input.closest('label').firstChild.textContent=profile.quantity+' ';$('risk-edit-auto-pnl').disabled=this.enabled();if(this.enabled())$('risk-edit-auto-pnl').checked=false;},
 preview(){if(!this.current)return;this.adapt();const result=this.result();$('asset-form-preview').textContent=this.enabled()?(result.error?'○ '+result.error:JournalForm.status(result.value)):'Nhập tay như hiện tại. Bật xác minh để tính 1R/Net từ dữ kiện đã đối soát.';},
 change(event){const el=event.target;if(!this.current)return;if(el.dataset.p4==='asset_class'){$('risk-edit-market').value=JournalForm.profiles[el.value].market;$('asset-form-fields').querySelector('[data-p4="quantity_step"]').value=JournalForm.profiles[el.value].step;$('asset-form-fields').querySelector('[data-p4="multiplier_verified"]').checked=false;}else if(el.id==='risk-edit-market'){const asset=JournalForm.asset(el.value);$('asset-form-fields').querySelector('[data-p4="asset_class"]').value=asset;$('asset-form-fields').querySelector('[data-p4="quantity_step"]').value=JournalForm.profiles[asset].step;}this.preview();},
};
Object.assign(globalThis.Unified,{AdaptiveTradeForm});
function openAddTradeModal(){if(!allowNewTrade())return;editorId=null;cbBuildForm();$('risk-detail-title').textContent='Thêm giao dịch mới (V6 standard)';const fields={'risk-edit-symbol':'','risk-edit-pnl':'','risk-edit-risk':state.defaultRisk1R||'','risk-edit-hold':'','risk-edit-open':'','risk-edit-close':'','risk-edit-entry':'','risk-edit-sl':'','risk-edit-tp':'','risk-edit-exit':'','risk-edit-lots':'','adv-edit-mae':'','adv-edit-mfe':'','adv-edit-slip':'','adv-edit-tick':''};for(const [id,value] of Object.entries(fields))$(id).value=value;$('risk-edit-error').replaceChildren($('trade-metrics-preview'),$('modal-tier-note'),$('modal-setup-tier2-hint'));$('risk-edit-exit-reason').value=editorId?(state.trades.find(t=>String(t.id)===editorId)?.exitReason||'auto'):'auto';$('risk-edit-auto-pnl').checked=false;AdaptiveTradeForm.load(null);$('risk-detail-modal').classList.remove('hidden');previewTradeMetrics();}
function editorOpen(id){const t=state.trades.find(t=>String(t.id)===String(id));if(!t)return;editorId=String(id);editorBaseline=UnifiedJournal.stable(t);cbBuildForm();const map={'risk-edit-symbol':'symbol','risk-edit-pnl':'netPnl','risk-edit-risk':'initialRisk','risk-edit-hold':'holdMin','risk-edit-open':'openTime','risk-edit-close':'closeTime','risk-edit-entry':'entryPrice','risk-edit-sl':'slPrice','risk-edit-tp':'tpPrice','risk-edit-exit':'exitPrice','risk-edit-lots':'lots','adv-edit-mae':'maeR','adv-edit-mfe':'mfeR','adv-edit-slip':'slippage','adv-edit-tick':'tickSize'};for(const [id,key] of Object.entries(map))$(id).value=t[key]??'';for(const key of ['market','side','setup','discipline','review','tag'])$('risk-edit-'+key).value=t[key]||'';$('risk-detail-title').textContent=t.symbol+' · '+t.side+' · '+t.date+' · ID #'+t.id;$('risk-edit-error').replaceChildren($('trade-metrics-preview'),$('modal-tier-note'),$('modal-setup-tier2-hint'));$('risk-edit-exit-reason').value=editorId?(state.trades.find(t=>String(t.id)===editorId)?.exitReason||'auto'):'auto';$('risk-edit-auto-pnl').checked=false;AdaptiveTradeForm.load(t);$('risk-detail-modal').classList.remove('hidden');previewTradeMetrics();}
function editorClose(){$('risk-detail-modal').classList.add('hidden');editorId=null;}
function closeAddTradeModal(){editorClose();}
function submitNewTrade(){
 if(editorId&&editorBaseline!==UnifiedJournal.stable(state.trades.find(t=>String(t.id)===editorId)))return toast('Lệnh đã thay đổi ở giao diện khác; giữ nguyên form để đối chiếu trước khi lưu');
 const existing=editorId&&state.trades.find(t=>String(t.id)===editorId),draft=existing?cloneValue(existing):{id:crypto.randomUUID(),date:todayISO(),hour:String(new Date().getHours()).padStart(2,'0')+':00',riskEstimated:false};
 if(!existing&&!allowNewTrade())return;
 draft.symbol=$('risk-edit-symbol').value.trim().toUpperCase();draft.netPnl=Number($('risk-edit-pnl').value);
 if(!draft.symbol||($('risk-edit-pnl').value.trim()===''&&!$('risk-edit-auto-pnl').checked&&!AdaptiveTradeForm.enabled())||!Number.isFinite(draft.netPnl))return toast('Nhập mã sản phẩm và lãi/lỗ của lệnh');
 for(const key of ['market','side','setup','discipline','review','tag']){const value=$('risk-edit-'+key).value;if(!value&&key!=='tag')return toast('Chọn '+key);draft[key]=value;}
 const map={risk:'initialRisk',hold:'holdMin',entry:'entryPrice',sl:'slPrice',tp:'tpPrice',exit:'exitPrice',lots:'lots'};
 for(const [id,key] of Object.entries(map)){const raw=$('risk-edit-'+id).value.trim(),value=raw===''?null:Number(raw);if(value!==null&&(!Number.isFinite(value)||(key==='holdMin'?value<0:value<=0)))return toast('Giá/khối lượng/1R phải lớn hơn 0; thời gian giữ ≥ 0');draft[key]=value;}
 for(const [id,key] of Object.entries({mae:'maeR',mfe:'mfeR',slip:'slippage',tick:'tickSize'})){const raw=$('adv-edit-'+id).value.trim(),value=raw===''?null:Number(raw);if(value!==null&&(!Number.isFinite(value)||(id==='mae'&&value>0)||(id==='mfe'&&value<0)||(id==='tick'&&value<=0)))return toast('MAE ≤ 0, MFE ≥ 0, tick > 0 và số hữu hạn.');draft[key]=value;}
 const open=$('risk-edit-open').value,close=$('risk-edit-close').value;if((open&&!close)||(!open&&close)||open&&Date.parse(close)<Date.parse(open))return toast('Cần cả giờ mở và đóng; giờ đóng phải sau giờ mở.');
 if(open){draft.openTime=open;draft.closeTime=close;draft.date=open.slice(0,10);draft.hour=open.slice(11,16);draft.holdMin=Math.round((Date.parse(close)-Date.parse(open))/60000);}else{delete draft.openTime;delete draft.closeTime;}
 if(draft.entryPrice&&draft.slPrice&&((draft.side==='Long'&&draft.slPrice>=draft.entryPrice)||(draft.side==='Short'&&draft.slPrice<=draft.entryPrice)))return toast('SL không đúng phía vị thế Long/Short.');
 draft.exitReason=$('risk-edit-exit-reason').value;if($('risk-edit-auto-pnl').checked){const metrics=RiskMath.calcTradeMetrics(draft);if(!Number.isFinite(metrics.actualR)||!(draft.initialRisk>0))return toast('Cần Entry, SL, Exit và 1R hợp lệ để tính P&L');draft.netPnl=metrics.actualR*draft.initialRisk;}draft.realizedR=draft.initialRisk>0?draft.netPnl/draft.initialRisk:null;draft.weekday=weekdayOf(draft.date);if(!existing||draft.initialRisk!==existing.initialRisk){draft.riskEstimated=false;draft.riskSource='MANUAL';}
 if(AdaptiveTradeForm.enabled()){try{const n=JournalForm.requireReady(JournalForm.preview({...AdaptiveTradeForm.read(),id:String(draft.id)}));Object.assign(draft,JournalForm.toV6(n,draft));}catch(error){return toast(error.message);}}
 if(writeData(d=>{if(existing)d.trades[d.trades.findIndex(t=>String(t.id)===editorId)]=draft;else d.trades.unshift(draft);})){editorClose();toast(existing?'Đã lưu chi tiết giá và thời gian vào nhật ký chung':'Đã thêm giao dịch');}
}

const LifecycleUI={
  owner(){return state.extra.classicSync?.owner||'device';},
  async backup(){await StorageVault.queue;if(StorageVault.lastError)throw Error('Chưa lưu được dữ liệu; hãy thử lại');const before=Core.backupText(),owner=this.owner(),prepared=await JournalLifecycle.prepare({v6:Core.snapshot()},owner,owner!=='device');if(Core.backupText()!==before||this.owner()!==owner)throw Error('Nhật ký đã thay đổi khi sao lưu; hãy thử lại');return prepared;},
  async chooseClean(){try{if(state.trades.length)throw Error('Nhật ký đang có dữ liệu; dùng chức năng xóa có sao lưu');JournalLifecycle.set('CLEAN_PRODUCTION',this.owner());Core.commit(d=>{delete d.extra.lifecycleFirstRun;});this.refresh();}catch(e){toast(e.message);}},
  async chooseDemo(which='A'){try{if(JournalLifecycle.read(this.owner()).noMock)throw Error('Đã khóa dữ liệu mẫu; dùng hồ sơ trình duyệt riêng để xem mẫu');if(state.trades.length||state.cashflows.length||state.initialCapital>0||(state.extra.mutation_oplog||[]).length)await this.backup();JournalLifecycle.set('DEMO_SANDBOX',this.owner());const data=Core.sample(which);data.extra=cloneValue(state.extra);data.ext2=cloneValue(state.ext2);data.extra.mutation_oplog=[];delete data.extra.lifecycleFirstRun;delete data.extra.accountBaselineConfirmed;Core.importBackup(JSON.stringify(data));initTheme();this.refresh();}catch(e){toast(e.message);}},
  async undo(){try{if(!(state.extra.mutation_oplog||[]).length)throw Error('Chưa có thao tác để hoàn tác');await this.backup();const result=JournalLifecycle.undo(state.trades,state.extra.mutation_oplog);if(JournalLifecycle.read(this.owner()).noMock&&result.rows.some(t=>t.origin==='MOCK_SEED_V3'))throw Error('Không khôi phục dữ liệu mẫu đã khóa');Core.commit(d=>{d.trades=result.rows;});Core.commit(d=>{d.extra.mutation_oplog=result.history;});toast('Đã hoàn tác');}catch(e){toast(e.message);}},
  async remove(id){try{await this.backup();const result=JournalLifecycle.trash(state.trades,[id],state.extra.trash||[]);Core.commit(d=>{d.trades=result.rows;d.extra.trash=result.trash;});editorClose();toast('Đã chuyển vào thùng rác 30 ngày');}catch(e){toast(e.message);}},
  async restore(id){try{const result=JournalLifecycle.restore(state.trades,state.extra.trash||[],id),owner=this.owner();if(owner!=='device'){
    if(ClassicSync.busy)throw Error('Đang đồng bộ; hãy thử lại khi hoàn tất');await ClassicSync.tick();if(state.extra.classicSync?.pending?.length)throw Error('Bản chờ chưa đồng bộ xong; chưa khôi phục để tránh xung đột');let url='/api/trades?trash=1&limit=1000',found=null;do{const page=await ClassicSync.request(url);found=page.trades.find(t=>String(t.id)===String(id));url=page.next?'/api/trades?trash=1&limit=1000&cursor='+encodeURIComponent(page.next):'';}while(url&&!found);if(!found)throw Error('Không tìm thấy lệnh còn hạn trong thùng rác cloud');const ack=await ClassicSync.request('/api/trades',{method:'PATCH',body:JSON.stringify({trade:{id:found.id,version:found.version},restore:true})});ClassicSync.applying=true;try{Core.commit(d=>{d.trades.push(ClassicSync.fromClassic(ack.trade));d.extra.trash=result.trash;});}finally{ClassicSync.applying=false;}
  }else{Core.commit(d=>{d.trades=result.rows;d.extra.trash=result.trash;});}this.showTrash();toast('Đã khôi phục lệnh');}catch(e){toast(e.message);}},
  showTrash(){const host=$('lifecycle-trash');host.replaceChildren();for(const item of state.extra.trash||[]){const row=document.createElement('div'),button=document.createElement('button');row.textContent=item.trade.symbol+' · '+item.trade.date+' · ';button.className='border rounded px-2 py-1';button.textContent=Date.parse(item.expiresAt)<Date.now()?'Đã hết hạn khôi phục':'Khôi phục';button.disabled=Date.parse(item.expiresAt)<Date.now();button.onclick=()=>this.restore(item.trade.id);row.appendChild(button);host.appendChild(row);}if(!host.childNodes.length)host.textContent='Thùng rác trống';},
  async reset(){const previousBlocked=ClassicSync.blocked;ClassicSync.blocked=true;clearTimeout(ClassicSync.pumpTimer);try{for(let attempt=0;ClassicSync.busy&&attempt<400;attempt++)await new Promise(resolve=>setTimeout(resolve,25));if(ClassicSync.busy)throw Error('Đồng bộ chưa hoàn tất; chưa thay đổi dữ liệu. Hãy thử lại sau.');const prepared=await this.backup(),owner=this.owner();ClassicSync.blocked=true;clearTimeout(ClassicSync.pumpTimer);const result=await JournalLifecycle.hardReset(prepared,owner,owner!=='device');UnifiedView.snapshot=await UnifiedJournal.read(owner);WorkerBridge.close();RiskStore.jobCache.clear();RiskStore.pendingJobs.clear();const empty=Core.empty();empty.extra=cloneValue(extraDefaults);empty.ext2=cloneValue(extDefaults);Core.persist(empty);Core.replace(empty);await StorageVault.queue;ClassicSync.owner=null;ClassicSync.summary=null;JournalLifecycle.set('CLEAN_SLATE_LOCKED',owner);if(owner!=='device')JournalLifecycle.set('CLEAN_SLATE_LOCKED','device');this.refresh();toast(result?.cleanupErrors?.length?'Nhật ký đã xóa; một số tệp cloud đang chờ dọn. Bản sao đã lưu.':'Đã xóa sạch nhật ký; dữ liệu mẫu đã bị khóa.');}catch(e){ClassicSync.blocked=previousBlocked;toast(e.message);}},
  refresh(){const el=$('lifecycle-status');if(!el)return;const l=JournalLifecycle.read(this.owner()),names={UNINITIALIZED_FIRST_RUN:'Chọn cách bắt đầu nhật ký',CLEAN_PRODUCTION:'Nhật ký trống',DEMO_SANDBOX:'Đang xem dữ liệu mẫu',CLEAN_SLATE_LOCKED:'Đã khóa dữ liệu mẫu',LIVE_PRODUCTION:'Nhật ký của bạn'};el.textContent=names[l.status]+(l.noMock?' · Không tự nạp lại dữ liệu mẫu':'');$('lifecycle-first').hidden=l.status!=='UNINITIALIZED_FIRST_RUN';$('load-sample').disabled=l.noMock;}
};
function renderAll(){if(renderBusy)return;renderBusy=true;try{LifecycleUI.refresh();syncSettingsUI();syncRiskProfile();rebuildSavedViews();renderCustomTagsPills();updateFilters();renderVisiblePage();}finally{renderBusy=false;ClassicSync.status();if(state.currency==='VND')currencyLabels();setTimeout(()=>ensureLargeCI(),0);}}
function renderVisiblePage(){const key=document.body.dataset.page;if(key==='gameplan')renderGameplan();if(key==='calendar')renderCalendar();if(key==='review')renderReview();if(key==='chartbook')renderChartbook();if(key==='risktools')renderChecklist();if(['simulation','riskprop','risktools','zones'].includes(key))renderP5Page(key);if(key==='riskopt')renderRiskCompare();if(key==='riskcapital')renderFeedback();if(key==='mapping')renderSchemaExplorer();if(['cockpit','riskcapital','riskedge','riskopt','pnlrisk','zones'].includes(key))renderRiskPages(key);}
function showTab(key){const valid=Object.hasOwn(TABS,key)?key:'workspace',target=['overview','edge','drilldown','discipline'].includes(valid)?'edge':valid;document.querySelectorAll('.main-tab-content').forEach(el=>el.classList.toggle('hidden',el.id!=='tab-'+target));document.querySelectorAll('#sidebar a').forEach(a=>{const active=a.hash==='#'+valid;a.classList.toggle('sidebar-item-active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('page-h1').textContent=TITLES[valid];document.title=TITLES[valid]+' – Tuan Trader V6';document.body.dataset.page=valid;if(target==='edge')applyEdgeView(valid);renderVisiblePage();setTimeout(()=>Object.values(charts).forEach(c=>c?.resize()),50);if(innerWidth<1024)$('sidebar').classList.add('hidden');}
function rawTab(){const key=location.hash.slice(1).split('?')[0];return TAB_ALIAS[key]||key;}
function hashTab(){return rawTab();}
function switchSidebarTab(id){go(id);}
function go(key){location.hash=key.replace(/^#/,'');route();}
function route(){const query=location.hash.split('?')[1]||'',q=new URLSearchParams(query),op=(q.get('operator')||'').toUpperCase();if(op==='AND'||op==='OR')$('filter-operator').value=op;for(const cat of Object.keys(CB_FIELDS)){const match=query.match(new RegExp('(?:^|&)'+cat+'=([^&]*)'));if(match)$('filter-'+cat).value=match[1]?match[1].split(',').map(decodeURIComponent).join('|'):'ALL';}showTab(rawTab()||'workspace');updateFilters();}
async function boot(){document.body.inert=true;document.body.setAttribute('aria-busy','true');
 try{await StorageVault.recoverIfMissing();Core.migrateLegacy();const d=Core.snapshot();d.extra={...cloneValue(extraDefaults),...d.extra};d.ext2={...cloneValue(extDefaults),...d.ext2};Core.replace(d);await ClassicSync.confirmOwnerBeforeView();await UnifiedView.init();RiskStore.configure({date:todayISO(),today:todayISO()});cbInit();bindSourceEvents();bindRiskEvents();bindP5Events();bindAccessibility();retireLegacyCache().catch(()=>{});initTheme();Core.subscribe(()=>{renderAll();StorageVault.enqueue();if(ClassicSync.owner&&!ClassicSync.applying){clearTimeout(ClassicSync.pumpTimer);ClassicSync.pumpTimer=setTimeout(()=>ClassicSync.tick(),300);}});StorageVault.enqueue();renderDictionaryCards();runMappingDemo('STOCKS');route();renderAll();LifecycleUI.refresh();window.addEventListener('journal-lifecycle-updated',()=>LifecycleUI.refresh());if(migrationBackup){const btn=document.createElement('button');btn.type='button';btn.textContent='Tải lại bản sao lưu dữ liệu cũ';btn.onclick=()=>downloadJson('tuannhatky-before-migration.json',JSON.stringify(migrationBackup,null,2));$('stage-status').appendChild(btn);}window.addEventListener('hashchange',route);setTimeout(()=>ClassicSync.init().catch(error=>{ClassicSync.message=error.message;ClassicSync.status();}),0);bootProblem=null;document.body.inert=false;document.body.dataset.ready='true';document.body.setAttribute('aria-busy','false');}
 catch(error){document.body.inert=false;document.body.setAttribute('aria-busy','false');bootProblem=error.message;$('stage-status').textContent='Chưa nạp dữ liệu: '+error.message;console.error(error);}
}
// P4: page renderers read the shared RiskStore; form handlers write only Core.
const riskFmt=(v,n=2)=>v===Infinity?'∞':v===-Infinity?'−∞':Number.isFinite(v)?v.toFixed(n):'–';
const moneySymbol=()=>state.currency==='VND'?'₫':'$';
function currencyLabels(){const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(node.parentElement?.closest('script,style,textarea'))continue;if(node.nodeValue.includes('$'))node.nodeValue=node.nodeValue.replaceAll('$','₫');}const note=$('journal-currency-note');if(note)note.textContent='Sổ Classic: VNĐ (₫), P&L đã trừ phí/swap một lần. Giá khớp giữ đơn vị thị trường; thiếu 1R/chi phí được giữ là chưa xác minh.';}
const riskMoney=v=>Number.isFinite(v)?(v<0?'−':'')+moneySymbol()+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'–';
const riskPct=v=>Number.isFinite(v)?(v*100).toFixed(2)+'%':'–';
const riskStat=(label,value,note='',header=false)=>header==='source'?'<div class="border rounded-lg bg-slate-50 p-3"><p class="text-slate-500 text-xs">'+label+'</p><b class="text-xl tabular-nums">'+value+'</b>'+(note?'<p class="text-xs text-slate-500 mt-1">'+note+'</p>':'')+'</div>':header?'<div class="rounded-xl bg-slate-800 px-3 py-3"><div class="text-xs text-slate-300">'+label+'</div><div class="text-lg font-bold mt-1 tabular-nums">'+value+'</div><div class="text-[11px] text-slate-400">'+note+'</div></div>':'<div class="rounded-lg border border-slate-200 bg-white p-3"><div class="text-xs text-slate-500">'+E(label)+'</div><div class="text-xl font-bold tabular-nums">'+E(value)+'</div><div class="text-xs text-slate-500">'+E(note)+'</div></div>';
const profileInputs={'tc-acct':'acct','tc-prop':'propKey','tc-t2':'t2','tc-t3':'t3','tc-ovr':'tierOverride','bud-k':'k','bud-f':'fTier','ck-daily':'dailyLossLimit','ck-personal':'personalDailyLimit','ck-maxdd':'maxDrawdown','ck-ddmode':'ddMode'};
const assumptionInputs={'as-tier-cap':'tierCapMode','as-tail-mode':'tail25Mode','as-safe-tier':'safeTierMax','as-rec-rule':'recRule','as-lock-stress':'lockStressLab'};
let riskVerifySerial=0;
let recoverySequence=0;
let recoveryRequestedKey=null;
let journalColumnGroup='basic',journalHeader=null,journalPage=0;const journalPageSize=200;
function formOptionPool(category){let pool=cbPool(category);const used=new Set(state.trades.map(t=>t[category])),preferred=new Map();for(const o of pool){const old=preferred.get(o.l);if(!old||!used.has(old.v)&&used.has(o.v))preferred.set(o.l,o);}return pool.filter(o=>preferred.get(o.l).v===o.v||used.has(o.v));}
function restoreJournalHeader(){if(!journalHeader)return;const head=$('workspace-table-body').parentElement.querySelector('thead');if(head!==journalHeader)head.replaceWith(journalHeader);}
function renderJournalColumns(trades){const table=$('workspace-table-body').parentElement,head=table.querySelector('thead');if(!journalHeader)journalHeader=head;const cols=journalColumnGroup==='price'?[['Mã','symbol'],['Giờ mở','openTime'],['Giờ đóng','closeTime'],['Entry','entryPrice'],['SL','slPrice'],['TP','tpPrice'],['Exit','exitPrice'],['Lot / Qty','lots'],['Planned RR','plannedRR'],['Actual R','actualR'],['Pips/Ticks','pipDiff']]:[['Mã','symbol'],['1R ($)','initialRisk'],['MAE (R âm hoặc 0)','maeR'],['MFE (R dương hoặc 0)','mfeR'],['Net R','netR'],['Trượt giá (R)','slippageR'],['Thời gian giữ (giờ)','durationHours'],['Lý do thoát','exitReason']];const next=document.createElement('thead');next.className=journalHeader.className;next.innerHTML='<tr>'+cols.map(([label])=>'<th class="p-3 text-left whitespace-nowrap">'+E(label)+'</th>').join('')+'</tr>';head.replaceWith(next);$('workspace-table-body').innerHTML=trades.map(t=>{const metrics=RiskMath.calcTradeMetrics(t);return '<tr data-id="'+E(t.id)+'" class="border-b">'+cols.map(([,key])=>{let value=key==='netR'?netR(t):key in metrics?metrics[key]:t[key];return '<td class="p-3 text-xs whitespace-nowrap" tabindex="0">'+E(typeof value==='number'?riskFmt(value):value??'–')+'</td>';}).join('')+'</tr>';}).join('');}
function syncRiskProfile(){const p=state.riskProfile;for(const [id,key] of Object.entries(profileInputs))if($(id))$(id).value=p[key];for(const [id,key] of Object.entries(assumptionInputs))if($(id))$(id).value=typeof p.assumptions[key]==='boolean'?Number(p.assumptions[key]):p.assumptions[key];for(const el of document.querySelectorAll('[name="rck-mode-rad"]'))el.checked=el.value===p.assumptions.rckMode;if($('adv-rck-alpha'))$('adv-rck-alpha').value=(p.rckAlpha??.05)*100;if($('adv-rck-beta'))$('adv-rck-beta').value=(p.rckBeta??.2)*100;}
function tierCfg(mode){const next={};for(const [id,key] of Object.entries(profileInputs)){const raw=$(id).value;next[key]=['acct','propKey','ddMode'].includes(key)||key==='tierOverride'&&raw==='auto'?raw:Number(raw);}if(mode!=='manual'){next.t2=next.acct==='prop'?2:3;next.t3=next.acct==='prop'?3.5:5;if(next.acct==='prop'&&next.propKey==='custom')next.propKey='ftmo';}writeData(d=>Object.assign(d.riskProfile,next));syncRiskProfile();}
function budCfg(){tierCfg('manual');}
function updateCockpitSettings(){tierCfg('manual');}
function saveAssumption(key,value){writeData(d=>d.riskProfile.assumptions[key]=value);}
function updateRiskControls(values){RiskStore.configure(values);renderSharedStatus();renderRiskHeader();renderVisiblePage();}
function updateDailyLossTracker(){const value=id=>$(id).value.trim()===''?null:Number($(id).value);updateRiskControls({date:$('dl-date-pick').value||todayISO(),today:todayISO(),override:value('dl-realized-ovr'),floating:value('dl-floating-input')});}
function allowNewTrade(){const s=RiskStore.read();if(s.tier===3||s.daily.stopped||s.limits.stopped||s.details.exposure.blocked){toast('Drawdown hiện tại vượt ngưỡng an toàn. Khuyến nghị dừng giao dịch thực tế để rà soát hệ thống. Nhật ký vẫn ghi nhận đầy đủ.');if(state.extra.accountProfile?.strictMode===true&&!confirm('Ghi nhận giao dịch thực tế dù đang có cảnh báo rủi ro?'))return false;}return true;}
function renderRiskHeader(){const s=RiskStore.read(),p=state.riskProfile,d=s.daily;
 $('cockpit-exp-val').textContent=riskFmt(s.edge.expectancy)+' R';$('cockpit-ror-val').textContent=riskPct(s.details.ror.balsara)+' (Balsara)';$('cockpit-rck-val').textContent=riskPct(s.recommendation);$('cockpit-es-val').textContent=tailDisplay(s)+' R';$('cockpit-status-badge').textContent='TIER '+s.tier+' '+(s.gates.pass?'ĐỦ ĐIỀU KIỆN':'CỔNG ĐÓNG');$('cockpit-warning-box').textContent='Drawdown thực tế '+riskPct(s.dd)+' · Expectancy '+riskFmt(s.edge.expectancy)+'R · Ω(0) '+riskFmt(s.edge.omega0)+' · ES 97,5% '+tailDisplay(s)+'R · Đề xuất '+riskPct(s.recommendation);const plan=$('gp-save');if(plan)plan.disabled=s.tier===3||d.stopped||s.limits.stopped;
 $('top-dd-gauge-bar').style.width=Math.min(100,s.dd*100/p.t3*100)+'%';$('top-dd-gauge-txt').textContent=riskPct(s.dd)+' / '+p.t3.toFixed(2)+'%';$('top-dl-bar').style.width=d.used+'%';$('top-dl-txt').textContent=(d.remainingR===null?'Chưa thiết lập':riskFmt(d.remainingR)+'R còn lại')+' ('+riskMoney(d.loss)+'/'+riskMoney(d.limit)+')';
 const banner=$('interlock-banner');banner.className=s.tier===1&&!d.stopped&&!s.limits.stopped&&!s.details.exposure.blocked?'hidden':'p-3 rounded-lg text-sm font-bold border '+(s.tier===3||d.stopped||s.limits.stopped||s.details.exposure.blocked?'bg-rose-50 border-rose-500 text-rose-900':'bg-amber-50 border-amber-400 text-amber-900');banner.textContent=s.limits.stopped?'Đã chạm sụt giảm tối đa. Khuyến nghị rà soát; nhật ký vẫn nhận dữ liệu.':d.stopped?'ĐÃ CHẠM HẠN MỨC LỖ NGÀY. Nhật ký vẫn nhận dữ liệu.':s.details.exposure.blocked?'Phơi nhiễm đang mở cao. Nhật ký vẫn nhận dữ liệu.':s.tier===2?'TIER 2: Drawdown '+riskPct(s.dd)+'. Khối lượng mặc định tự giảm 50%.':'TIER 3 – CIRCUIT BREAKER: Drawdown '+riskPct(s.dd)+'. Khuyến nghị dừng giao dịch thực tế để rà soát hệ thống; vẫn cho phép nhập liệu.';
 const chip=(ok,title,value)=>'<div class="p-2 rounded-lg border '+(ok?'bg-emerald-50 border-emerald-300 text-emerald-900':'bg-rose-50 border-rose-400 text-rose-900')+'"><span class="text-[10px] uppercase font-bold block">'+title+'</span><b>'+(ok?'✔ ':'✖ ')+E(value)+'</b></div>';
 $('gate-strip').innerHTML=chip(s.gates.safety,'Safety Gate · Lớp 1','Tier '+s.tier+' · DD '+riskPct(s.dd))+chip(s.gates.edge,'Edge Gate · Lớp 2','Expectancy '+riskFmt(s.edge.expectancy)+'R · Ω(0) '+riskFmt(s.edge.omega0))+chip(s.gates.sample,'Sample Gate','N='+s.edge.n+' (cần ≥30)');
 const gate=$('gate-l3');gate.className=s.gates.pass?'hidden':'p-3 rounded-lg border border-rose-400 bg-rose-50 text-rose-900 text-sm';gate.textContent='Cổng liên động đang khóa: '+[!s.gates.safety?'Safety Gate':'',!s.gates.edge?'Edge Gate':'',!s.gates.sample?'Cỡ mẫu dưới 30':''].filter(Boolean).join('; ')+'. Đề xuất rủi ro = 0.';$('tab-riskopt').classList.toggle('gate-locked',!s.gates.pass);$('risk-opt-run').disabled=!s.gates.pass;
 const summary=riskStat('Equity cuối kỳ',riskMoney(s.equity),'Đã cộng lệnh & nạp/rút',true)+riskStat('Nạp/rút thuần',riskMoney(s.flows),state.cashflows.length+' bút toán',true)+riskStat('DD chuẩn hóa',riskPct(s.dd),'NAV time-weighted',true)+riskStat('Lệnh trong bộ lọc',String(lastDataset.length),'R hợp lệ: '+s.edge.n,true);$('risk-summary-cards').innerHTML=summary;$('risk-gate-badge').textContent='Tier '+s.tier+' · '+(s.gates.pass?'ĐỦ ĐIỀU KIỆN':'CỔNG ĐÓNG');
 for(const id of ['risk-quality','risk-edge-quality'])$(id).textContent=s.edge.n+' lệnh có 1R đã xác minh / '+lastDataset.length+' lệnh đang lọc. '+(!s.advancedSummary.active.ready?tailDisplay(s)+'. ':'')+(s.warning?' Một số Net P&L chưa xác minh; vốn chỉ cộng khoản đã đối soát.':'');
 $('daily-budget-max-risk').textContent=riskMoney(s.budget)+' ('+riskPct(s.equity>0?s.budget/s.equity:0)+')';$('daily-budget-detail').textContent='min(Vốn × f_tier × hệ số Tier, hạn mức lỗ ngày ÷ k='+p.k+')';$('risk-budget').textContent='Max Risk / Trade: '+riskMoney(s.budget)+' · f_tier '+p.fTier+'% · Tier '+s.tier;
}
function renderCockpit(){const s=RiskStore.read(),d=s.daily,p=state.riskProfile;$('dl-date-pick').value=d.date||todayISO();const usd=riskMoney;const TONE={emerald:['bg-emerald-500','bg-emerald-50 text-emerald-700 border-emerald-200'],amber:['bg-amber-500','bg-amber-50 text-amber-700 border-amber-200'],rose:['bg-rose-500','bg-rose-50 text-rose-700 border-rose-200']};
            const cockpitHelp=(k)=>'<button onclick="openTooltipModal(\''+k+'\')" class="w-[14px] h-[14px] ml-1.5 rounded-full bg-slate-100 hover:bg-brand-100 text-slate-500 hover:text-brand-600 inline-flex items-center justify-center text-xs font-bold" aria-label="Giải thích">?</button>';
            const gauge=(title,key,used,limit)=>{
                const ok=limit>0,p=ok?used/limit:0,t=p>=1?'rose':p>=0.7?'amber':'emerald',lab=!ok?'Chưa đặt hạn mức':p>=1?'Vượt hạn mức':p>=0.7?'Cảnh báo ≥70%':'An toàn';
                return '<div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"><div class="text-xs font-semibold text-slate-500">'+title+cockpitHelp(key)+'</div><div class="text-[28px] leading-tight font-bold tabular-nums text-slate-900 mt-2">'+usd(used)+' <span class="text-sm font-medium text-slate-500">/ '+usd(limit)+'</span></div><div class="h-2 bg-slate-100 rounded mt-3 overflow-hidden"><div class="h-2 '+TONE[t][0]+'" style="width:'+Math.min(100,p*100).toFixed(0)+'%"></div></div><span class="inline-block mt-3 px-2 py-0.5 text-xs font-semibold rounded border '+TONE[t][1]+'">'+lab+(ok?' · '+(p*100).toFixed(0)+'%':'')+'</span></div>';};
            $('ck-cards').innerHTML=riskStat('Vốn thực tế (Adjusted)',riskMoney(s.equity),'Nạp/Rút ròng '+riskMoney(s.flows))+gauge('Lỗ ngày so với hạn mức quỹ','daily_loss',d.loss,p.dailyLossLimit)+gauge('Lỗ ngày so với ngưỡng tự khóa','daily_loss',d.loss,p.personalDailyLimit)+gauge('Sụt giảm ('+(p.ddMode==='trailing'?'Trailing':'Static')+')','dd_limit',s.limits.used,p.maxDrawdown);
 $('dl-progress-label').textContent='Đã dùng: '+riskMoney(d.loss)+' / '+riskMoney(d.limit)+' ('+riskFmt(d.used,1)+'%)';$('dl-remaining-r').textContent='Còn lại: '+riskFmt(d.remainingR)+' R ('+riskMoney(d.remaining)+')';$('dl-progress-bar').style.width=d.used+'%';$('dl-progress-bar').className='h-full transition-all duration-300 '+(d.exceeded?'bg-rose-500':d.used>=75?'bg-amber-400':'bg-emerald-500');$('dl-status-pill').textContent=d.stopped?'DỪNG GIAO DỊCH':d.exceeded?'NGÀY ĐÃ CHẠM HẠN MỨC':'ĐANG CHO PHÉP GIAO DỊCH';$('dl-stop-alert').classList.toggle('hidden',!d.exceeded);$('dl-stop-alert').textContent=(d.stopped?'ĐÃ CHẠM HẠN MỨC LỖ NGÀY. ':'Ngày đang xem đã chạm hạn mức. ')+'Nhật ký vẫn ghi nhận dữ liệu. '+'Thực đóng '+riskMoney(d.realized)+' · Floating '+riskMoney(d.floating);$('gate-cockpit').textContent='Lớp 3: '+(s.gates.pass?'ĐỦ ĐIỀU KIỆN THĂM DÒ':'KHÔNG ĐỦ ĐIỀU KIỆN')+' · E '+riskFmt(s.edge.expectancy)+'R · Ω(0) '+riskFmt(s.edge.omega0)+' · N '+s.edge.n;
 const a=s.details.setups.filter(x=>x.isGradeA),t2=$('tier2-action-panel'),t3=$('tier3-action-panel');t2.classList.toggle('hidden',s.tier!==2);t3.classList.toggle('hidden',s.tier!==3);t2.innerHTML='<b>Tier 2: Ưu tiên Setup hạng A</b><p>Khối lượng mặc định −50%. '+(a.length?a.map(x=>E(x.name)).join(', '):'KHÔNG có Setup hạng A nào đủ điều kiện, khuyến nghị rà soát Setup; nhật ký vẫn ghi nhận mọi giao dịch thực tế.')+'</p>';t3.innerHTML='<b>Tier 3 – HARD STOP</b><p>Profit Factor 15 lệnh cuối: '+riskFmt(s.details.recent.pf)+' · E '+riskFmt(s.details.recent.exp)+'R. Khuyến nghị dừng giao dịch thực tế; vẫn cho phép ghi nhận.</p><a href="#simulation" class="underline">Monte Carlo phục hồi</a>';
 $('tc-live').textContent='Tier '+s.tier+' · Ngưỡng Tier 2 '+p.t2+'% / Tier 3 '+p.t3+'% · '+p.acct;renderTierProtocol();renderSess();renderOpenPositions();renderCashflowTable();}
function renderSess(){const mode=$('tc-sess').value,items=lastDataset.filter(t=>mode==='all'||(Number((t.openTime||t.date+'T'+(t.hour||'00:00')).slice(11,13))<12?'am':'pm')===mode).slice().sort((a,b)=>Date.parse(a.openTime||a.date)-Date.parse(b.openTime||b.date)).slice(-15),s=RiskMath.groupStats(items.map(netR).filter(Number.isFinite));$('tc-sessout').textContent='Chẩn đoán 15 lệnh gần nhất: '+s.n+' lệnh · E '+riskFmt(s.exp)+'R · Win Rate '+riskPct(s.win)+' · PF '+riskFmt(s.pf);}
function renderOpenPositions(){const panel=$('open-positions-panel');if(!panel)return;panel.innerHTML=(state.openPositions||[]).map(t=>'<div class="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs border rounded p-2"><b>'+E(t.symbol)+' · '+E(t.side)+'</b><label>Rủi ro ($)<input aria-label="Rủi ro '+E(t.symbol)+'" type="number" min="0" step="any" class="border rounded p-1 w-full" data-position="'+E(t.id)+'" data-key="initialRisk" value="'+E(t.initialRisk??t.plannedRiskUsd??0)+'"></label><label>Floating ($)<input aria-label="Floating '+E(t.symbol)+'" type="number" step="any" class="border rounded p-1 w-full" data-position="'+E(t.id)+'" data-key="floatingUsd" value="'+E(t.floatingUsd??0)+'"></label><span>'+E(t.lots??'')+' Lot / Qty</span><button data-remove-position="'+E(t.id)+'" class="text-rose-700 border rounded">Xóa vị thế</button></div>').join('')||'<p class="text-xs text-slate-500">Chưa có vị thế đang mở.</p>';}
function addOpenPosition(){const symbol=prompt('Mã sản phẩm của vị thế đang mở:');if(!symbol?.trim())return;writeData(d=>d.openPositions.push({id:crypto.randomUUID(),symbol:symbol.trim().toUpperCase(),side:'Long',initialRisk:0,floatingUsd:0}));}
function renderCashflowTable(){$('cashflow-table-body').innerHTML=state.cashflows.map(cf=>'<tr><td class="p-2.5 font-bold">'+E(cf.id)+'</td><td class="p-2.5">'+E(cf.time.replace('T',' '))+'</td><td class="p-2.5 font-bold '+(cf.type==='DEPOSIT'?'text-emerald-600':'text-rose-600')+'">'+(cf.type==='DEPOSIT'?'NẠP VỐN (+)':'RÚT VỐN (-)')+'</td><td class="p-2.5 text-right font-bold font-mono">'+riskMoney(cf.amount)+'</td><td class="p-2.5 text-slate-500">'+E(cf.note)+'</td></tr>').join('');}
function toggleCashflowModal(){if(state.extra.classicSync?.owner){location.href='/classic#risk';return;}$('cashflow-modal').classList.toggle('hidden');if(!$('cashflow-modal').classList.contains('hidden'))$('cf-time').value=ymd(new Date())+'T'+new Date().toTimeString().slice(0,5);}
function saveCashflow(event){event.preventDefault();try{const flow=Core.normalizeFlow({id:crypto.randomUUID(),time:$('cf-time').value,type:$('cf-type').value,amount:Number($('cf-amount').value),note:$('cf-note').value},'manual',0);if(writeData(d=>d.cashflows.push(flow))){toggleCashflowModal();toast('Đã hạch toán nạp/rút vào sổ chung');}}catch(error){toast(error.message);}}
function riskChart(id,type,labels,datasets,options={}){if(!$(id))return;ChartRegistry.draw(id,$(id),{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:datasets.length>1,labels:{boxWidth:10,font:{size:10}}}},...options}});}
function updateAsymmetricRecovery(){const dd=Number($('input-dd-pct').value)/100;$('output-recovery-pct').textContent=dd>=0&&dd<1?riskPct(dd/(1-dd)):'–';const x=Array.from({length:19},(_,i)=>(i+1)*5);riskChart('risk-recovery-chart','line',x.map(x=>x+'%'),[{label:'Phục hồi cần thiết (%)',data:x.map(x=>x/(100-x)*100),borderColor:'#e11d48',pointRadius:0}],{scales:{y:{beginAtZero:true}}});}
function updateRiskOfRuin(){const floor=Number($('ror-floor').value)/100,risk=Number($('ror-risk').value)/100;if(!(floor>0&&floor<1&&risk>0&&risk<=.1)){toast('RoR: sàn trong (0,100%), risk trong (0,10%]');return;}const w=Number($('ror-winrate').value)/100,b=Number($('ror-payoff').value);if(!(w>=0&&w<=1&&b>0))return toast('Win Rate/Payoff không hợp lệ');updateRiskControls({floor,risk,w,b});}
function fillFromLog(){const s=RiskStore.read();$('ror-winrate').value=riskFmt(s.edge.winrate*100,1);$('ror-payoff').value=riskFmt(s.edge.payoff);updateRiskOfRuin();}
function toggleRorZoom(){saveAssumption('rorZoom',!state.riskProfile.assumptions.rorZoom);}
function renderCapital(){const s=RiskStore.read(),x=s.details.exposure,p=state.riskProfile,rr=s.details.ror;const manualDD=$('input-dd-pct').value,gate=s.tier===3?'TIER 3 · DỪNG ĐỀ XUẤT':s.tier===2?'TIER 2 · GIẢM 50%':'TIER 1 · TRONG GIỚI HẠN';$('risk-tier-stats').innerHTML='<div class="grid grid-cols-3 gap-2 text-xs"><div class="p-3 rounded-lg bg-emerald-50"><b>Tier 1</b><div>DD ≤ '+p.t2+'%</div><div>100% size</div><div>Xác suất thua 3 lệnh liên tiếp (1 − WR)³: '+(s.tierContext.threeLosses===null?'Chưa đủ dữ liệu':riskPct(s.tierContext.threeLosses))+'</div></div><div class="p-3 rounded-lg bg-amber-50"><b>Tier 2</b><div>'+p.t2+'% &lt; DD ≤ '+p.t3+'%</div><div>50% size</div></div><div class="p-3 rounded-lg bg-rose-50"><b>Tier 3</b><div>DD &gt; '+p.t3+'%</div><div>0% size</div></div></div><p class="font-semibold">Hiện tại: '+gate+' · DD đang chịu = '+riskPct(s.dd)+' · Max DD lịch sử = '+riskPct(s.maxdd)+'</p><p>Muốn phục hồi NAV về đỉnh cần <strong>'+(s.dd>=1?'không thể từ vốn bằng 0':riskPct(s.dd/(1-s.dd)))+'</strong> tăng trưởng trên đáy hiện tại.</p>'+$('input-dd-pct').parentElement.outerHTML+$('output-recovery-pct').parentElement.outerHTML;$('input-dd-pct').value=manualDD;updateAsymmetricRecovery();
 $('risk-overlap').textContent=x.eligible+' lệnh đủ giờ mở/đóng; '+x.missing+' lệnh chưa đủ dữ liệu. Rủi ro đang mở '+riskMoney(x.openRisk)+' ('+riskPct(x.openPct)+').';$('simultaneous-exposure-summary').innerHTML='<strong>Cảnh báo Phơi Nhiễm Trùng Giờ:</strong> Tổng rủi ro tại đỉnh trùng lặp: <b>'+riskMoney(x.peak)+' ('+riskPct(x.peakPct)+')</b>.';$('adv-correlated').innerHTML='<h4 class="font-bold">Nhóm phơi nhiễm thời gian trùng nhau</h4><p class="text-xs text-slate-500 mb-2">Phân nhóm biểu tượng theo loại tài sản, KHÔNG phải hệ số tương quan được ước tính từ giá.</p>'+x.byGroup.map(g=>'<div class="flex justify-between"><span>'+E(g.name)+'</span><b>'+riskMoney(g.peak)+'</b></div>').join('');riskChart('chartSimultaneousExposure','line',x.points.map(v=>new Date(v.time).toLocaleString('vi-VN')),[{label:'Rủi ro trùng giờ ($)',data:x.points.map(v=>v.value),borderColor:'#d97706',pointRadius:0,fill:false}]);
 $('ror-approx').textContent=riskPct(rr.approx);$('ror-bal').textContent=riskPct(rr.balsara);$('ror-kau').textContent=riskPct(rr.kaufman);$('ror-emp').textContent=s.ror?riskPct(s.ror.probability):'Chưa chạy';$('ror-U').textContent=riskFmt(rr.U);$('risk-ror-result').textContent='Balsara '+riskPct(rr.balsara)+' · Kaufman (khuếch tán) '+riskPct(rr.kaufman);$('adv-ror-analytics').textContent='Mô hình hai kết cục, thời hạn vô hạn; W/Payoff lấy từ nhật ký đang lọc. RoR thực nghiệm có kỳ hạn chạy bằng Worker.';$('ror-winrate').value=riskFmt(rr.w*100,1);$('ror-payoff').value=riskFmt(rr.b);
 const zoom=p.assumptions.rorZoom;$('btn-ror-zoom').textContent=zoom?'🔍 Chế độ: Đang phóng đại quanh (W, b) hiện tại (±5% W, ±0.4 b)':'🔍 Chế độ: Toàn cảnh (Bấm để phóng đại quanh W, b)';$('ror-heat').innerHTML=renderRorHeatmap(rr.w,rr.b,RiskStore.controls.risk,RiskStore.controls.floor);
 const risks=Array.from({length:20},(_,i)=>(i+1)*.0025);riskChart('chartRorCliff','line',risks.map(v=>riskPct(v)),[{label:'RoR Balsara (%)',data:risks.map(v=>RiskMath.rorAnalytic(rr.w,rr.b,RiskStore.controls.floor,v)*100),borderColor:'#e11d48',pointRadius:0}],{scales:{y:{beginAtZero:true,max:zoom?undefined:100}}});}
async function runEmpiricalRor(){const s=RiskStore.read();if(!s.edge.n)return;const key=s.verificationKey;try{const job=await RiskStore.job('ror',{R:s.edge.returns,riskPct:RiskStore.controls.risk*100,ddLimit:RiskStore.controls.floor,runs:1000,horizon:RiskStore.controls.horizon,seed:20260101});if(!job.stale&&key===RiskStore.read().verificationKey)$('ror-emp').textContent=riskPct(job.result.probability);}catch(error){toast(error.message);}}
function propNeed(){const p=state.extra.prop||{},target=Number(p.target)||8,horizon=Number(p.horizon)||100,risk=RiskStore.read().budget/RiskStore.read().equity;return risk>0?target/100/(horizon*risk):0;}
function renderOmegaCurve(){updateRiskControls({one:$('om-setup-1').value||'ALL',two:$('om-setup-2').value||'NONE',L:Number($('om-l-slider').value)||0});}
function populateOmegaSetupSelectors(){const s=RiskStore.read(),names=s.details.setups.map(x=>x.name);for(const [id,key] of [['om-setup-1','one'],['om-setup-2','two']]){const el=$(id),cur=RiskStore.controls[key];el.innerHTML=(id==='om-setup-2'?'<option value="NONE">-- Không so sánh --</option>':'')+'<option value="ALL">Tất cả lệnh ('+s.edge.n+')</option><option value="GRADE_A">Chỉ A-Setup</option>'+names.map(n=>'<option value="'+E(n)+'">'+E(n)+'</option>').join('');el.value=[...el.options].some(o=>o.value===cur)?cur:'ALL';}}
function runWhatIfSimulation(){const mode=$('whatif-scenario-select').value;if(mode==='fixed_2r')$('risk-tp-r').value=2;if(mode==='fixed_15r')$('risk-tp-r').value=1.5;if(mode==='tight_sl_06')$('risk-sl-r').value=.6;updateRiskControls({tp:Number($('risk-tp-r').value),sl:Number($('risk-sl-r').value)});}
function setupTailDisplay(s,name){const g=s.advanced?.matrix.setup.groups.find(x=>x.name===name);if(!g)return 'Chưa có CI xác minh';if(!g.tail.ready)return 'Chưa đủ mẫu N='+g.tail.n+'/'+g.tail.requiredN;return 'ES97.5='+riskFmt(g.tail.es975)+'R · CI95% ['+g.tail.ci.es975.map(x=>riskFmt(x)).join('; ')+']';}
function tailDisplay(s,key='es975'){const t=(s.advanced?.tail||s.advancedSummary).active;if(!t.ready)return 'Chưa đủ mẫu N='+t.n+'/'+t.requiredN;return Number.isFinite(t[key])?riskFmt(t[key]):'Không xác định';}
function saveAdvancedRules(){try{const values={};for(const el of document.querySelectorAll('[data-p5-rule]')){const k=el.dataset.p5Rule;values[k]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:Number(el.value);if(el.type==='number'&&!el.value.trim())throw Error('Không để trống cấu hình thống kê');}RiskMath.advancedConfig({...state.riskProfile.assumptions,...values});writeData(d=>Object.assign(d.riskProfile.assumptions,values));toast('Đã lưu cấu hình thống kê; Tier và cổng không do gợi ý điều khiển.');}catch(error){toast(error.message);}}
function parsePlatPairs(text){const lines=text.trim().split(/\r?\n/).filter(s=>s.trim());if(!lines.length)return [];if(lines.length>5001)throw Error('Tối đa 5.000 cặp P&L');if(lines.shift().trim().toLowerCase().replace(/\s/g,'')!=='date,hpl,rtpl')throw Error('Cần header date,hpl,rtpl và số thập phân dấu chấm');return lines.map((line,i)=>{const cells=line.split(',').map(s=>s.trim());if(cells.length!==3||cells.some(s=>!s)||!Number.isFinite(Number(cells[1]))||!Number.isFinite(Number(cells[2])))throw Error('Dòng PLAT '+(i+2)+' không hợp lệ');return {date:cells[0],hpl:Number(cells[1]),rtpl:Number(cells[2])};});}
function savePlatPairs(){try{const pairs=parsePlatPairs($('p5-plat-pairs').value),proof=RiskMath.platEvidence(pairs,{...RiskStore.read().advancedConfig,platEnabled:true,platConfirmed:true});if(proof.status==='invalid')throw Error('Ngày/cặp P&L không hợp lệ hoặc trùng ngày; giữ dữ liệu đã lưu');writeData(d=>{d.extra.platPairs=pairs;});toast('Đã lưu '+pairs.length+' cặp P&L; bật PLAT và xác nhận đối soát để tính.');}catch(error){toast(error.message);}}
let advancedRunSerial=0,advancedAutoKey=null,advancedRunError=null;
async function runAdvancedAnalysis(){const s=RiskStore.read(),payload=s.inputs.advanced,serial=++advancedRunSerial,button=$('p5-advanced-run');if(button)button.disabled=true;advancedRunError=null;$('p5-advanced-status').textContent='Đang tính từ '+payload.R.length+' Net R đã xác minh trong Worker…';try{const job=await RiskStore.job('analytics',payload);if(serial!==advancedRunSerial)return;if(job.stale){advancedRunError='Nhật ký/cấu hình đã thay đổi; kết quả cũ không được trình bày.';return;}renderAdvancedEvidence();if(['cockpit','zones','riskopt'].includes(document.body.dataset.page))renderVisiblePage();}catch(error){advancedRunError=error.message;}finally{if(serial===advancedRunSerial){if(button)button.disabled=false;const el=$('p5-advanced-status');if(el&&advancedRunError)el.textContent=advancedRunError;}}}
function renderAdvancedEvidence(){const s=RiskStore.read(),c=s.advancedConfig,result=s.advanced,t=result?.tail||s.advancedSummary;if(!$('p5-tail-evidence'))return;for(const el of document.querySelectorAll('[data-p5-rule]')){const k=el.dataset.p5Rule;if(k==='baselFactor'&&!el.options.length)el.innerHTML=Object.entries(RiskMath.baselFactors()).map(([value,f])=>'<option value="'+value+'">'+E(f.label)+(f.days?' · '+f.days+' ngày':'')+'</option>').join('');if(document.activeElement!==el){if(el.type==='checkbox')el.checked=c[k];else el.value=c[k];}}const b=s.liquidity.basel;$('p5-basel-status').textContent='Thanh khoản tham khảo: '+b.label+' · LH '+riskFmt(b.days)+' ngày · hệ số √(LH/10) = '+riskFmt(b.factor,6)+(b.enabled&&b.reference?' · yếu tố được chọn rõ ràng, không suy từ mã lệnh.':'');
 const ci=x=>x?'['+riskFmt(x[0],4)+'; '+riskFmt(x[1],4)+']':'Không xác định',entry=(pool,name)=>'<article class="border rounded-lg p-3"><h3 class="font-bold text-sm">'+name+'</h3><p class="text-xs">N='+pool.n+' · khối lượng đuôi '+riskFmt(pool.mass)+' · yêu cầu N≥'+pool.requiredN+'</p>'+(pool.ready?'<p class="text-sm mt-2">ES 97,5%: <b>'+riskFmt(pool.es975,4)+'R</b> · VaR: '+riskFmt(pool.var975,4)+'R</p><p class="text-xs">|ES| / |VaR|: '+(pool.ratio===null?'Không xác định':riskFmt(pool.ratio,4))+' · ngưỡng '+riskFmt(c.fatTailThreshold,3)+'</p><p class="text-xs">CI 95% ES: '+(pool.ci?ci(pool.ci.es975):'Chưa chạy bootstrap')+' · CI tỷ số: '+(pool.ci?ci(pool.ci.ratio):'Chưa chạy bootstrap')+'</p>'+(pool.ci?'<p class="text-[11px] text-slate-500">'+pool.ci.replicates+' lần bootstrap · '+pool.ci.validRatios+' tỷ số hữu hạn; tối thiểu 80% mới có CI tỷ số.</p>':''):'<p class="font-semibold text-amber-700 text-sm mt-2">○ Chưa đủ mẫu N='+pool.n+'/'+pool.requiredN+' · chưa công bố ES/tỷ số/CI</p>')+'</article>';
 $('p5-tail-evidence').innerHTML=entry(t.all_trades,'all_trades · toàn bộ lệnh')+entry(t.losing_only,'losing_only · nhóm lệnh lỗ');const bound=RiskMath.rckBound(state.riskProfile.rckBeta??.2,state.riskProfile.rckAlpha??.05),example=RiskMath.rckBound(.7,.1,[.5]);$('p5-rck-reference').innerHTML='<b>RCK · λ=log(β)/log(α)</b><p>Hiện tại: α='+riskFmt(bound.alpha,3)+' là sàn vốn còn lại; β='+riskFmt(bound.beta,3)+' là giới hạn xác suất · λ='+riskFmt(bound.lambda,6)+'. Đây là ràng buộc mô hình, không là bảo đảm thực nghiệm.</p><p>Ví dụ tham chiếu α=0,7; β=0,1 → λ='+riskFmt(example.lambda,6)+'; 0,5^λ='+riskFmt(example.points[0].probability*100,4)+'%. <a class="underline" target="_blank" rel="noopener" href="https://web.stanford.edu/~boyd/papers/kelly.html">Busseti–Ryu–Boyd</a>.</p>';
 const matrix=$('p5-comparison-matrix');if(result){matrix.innerHTML=Object.entries(result.matrix).map(([key,dim])=>'<section><h3 class="font-semibold text-sm">'+({asset:'So sánh lớp tài sản',setup:'So sánh setup',discipline:'So sánh kỷ luật',time:'Lịch sử và cửa sổ gần nhất'})[key]+'</h3><div class="overflow-x-auto"><table class="w-full text-xs text-left"><thead><tr>'+['Nhóm','N','Expectancy Net R','WR','PF','ES 97,5% / CI 95%'].map(x=>'<th scope="col" class="border p-2">'+x+'</th>').join('')+'</tr></thead><tbody>'+dim.groups.map(g=>'<tr><th scope="row" class="border p-2">'+E(g.name)+'</th><td class="border p-2">'+g.n+'</td><td class="border p-2">'+(g.ready?riskFmt(g.expectancy,4):'Chưa đủ mẫu N='+g.n+'/'+c.compareMinN)+'</td><td class="border p-2">'+(g.ready?riskPct(g.win):'—')+'</td><td class="border p-2">'+(g.ready?(g.pf===Infinity?'∞':riskFmt(g.pf)):'—')+'</td><td class="border p-2">'+(g.tail.ready?riskFmt(g.tail.es975,4)+'R / '+ci(g.tail.ci?.es975):'Chưa đủ mẫu N='+g.tail.n+'/'+g.tail.requiredN)+'</td></tr>').join('')+'</tbody></table></div>'+(dim.omittedGroups?'<p class="text-xs">'+dim.omittedGroups+' nhóm ('+dim.omittedTrades+' lệnh) không dựng trong ma trận giới hạn 100 nhóm lớn nhất. Các lệnh vẫn có trong phân tích toàn bộ và nhật ký.</p>':'')+'</section>').join('');$('p5-advice').innerHTML='<b>Gợi ý cần người dùng đánh giá</b>'+result.advice.map(a=>'<p class="mt-2">'+E(a.text)+' <span class="text-xs">(Tin cậy '+E(a.confidence)+' · N='+a.n+')</span></p>').join('')+'<p class="text-xs text-slate-500 mt-2">'+E(result.confidenceNote)+'</p>';}else{matrix.textContent='Chưa tính ma trận; dùng nút tính CI ở trên. Các nhóm không đạt cỡ mẫu sẽ hiển thị chưa đủ mẫu.';$('p5-advice').textContent='Chưa có kết luận. '+(!t.active.ready?'Chưa đủ mẫu N='+t.active.n+'/'+t.active.requiredN+'. ':'')+'Gợi ý không tự đổi Tier, công thức, hạn mức hoặc cổng.';}
 const pairs=state.extra.platPairs||[],stamp=JSON.stringify(pairs),area=$('p5-plat-pairs');if(area.dataset.savedStamp!==stamp){area.value='date,hpl,rtpl\n'+pairs.map(p=>p.date+','+p.hpl+','+p.rtpl).join('\n');area.dataset.savedStamp=stamp;}const plat=result?.plat||RiskMath.platEvidence(pairs,c),labels={off:'Tắt · chưa đánh giá PLAT',unverified:'Chưa xác nhận HPL/RTPL đã đối soát',insufficient:'Chưa đủ mẫu N='+plat.n+'/250 ngày',invalid:'Dữ liệu ngày/cặp không hợp lệ hoặc trùng',undefined:'Không xác định: chuỗi hằng số'};$('p5-plat-status').textContent=plat.status==='ready'?({green:'✓ Xanh',amber:'! Hổ phách',red:'✕ Đỏ'})[plat.zone]+' · tham khảo · Spearman '+riskFmt(plat.spearman,4)+' · KS '+riskFmt(plat.ks,4)+' · '+plat.n+' ngày ('+plat.from+' – '+plat.to+'). Không đổi Tier/cổng.':labels[plat.status];const pending=RiskStore.pendingJobs.has('analytics'+JSON.stringify(s.inputs.advanced));$('p5-advanced-run').disabled=pending;$('p5-advanced-status').textContent=advancedRunError||(result?'':pending?'Đang tính CI trong Worker…':'Chưa chạy bootstrap');if(result)$('p5-advanced-status').textContent='Đã tính '+s.inputs.advanced.R.length+' Net R · '+result.config.tailBootstrapRuns+' bootstrap · '+result.elapsedMs+' ms trong '+(WorkerBridge.lastExecution||'cache')+'. Cấu hình và kết quả không ghi vào Tier/cổng.';if(!result&&!pending&&document.body.dataset.page==='riskedge'&&s.inputs.advanced.R.length<=20000){const key=JSON.stringify(s.inputs.advanced);if(advancedAutoKey!==key){advancedAutoKey=key;setTimeout(runAdvancedAnalysis,0);}}
}

function renderRiskEdge(){renderAdvancedEvidence();const s=RiskStore.read(),d=s.details,o=d.omega,t=s.tail;populateOmegaSetupSelectors();$('om-l-val').textContent=riskFmt(RiskStore.controls.L)+' R';
 const ds=[{label:'Ω(L) · '+o.one+' (n='+o.n1+')',data:o.points1,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,0.08)',fill:true,pointRadius:0,borderWidth:2.2},{label:'Đường cân bằng Ω = 1',data:o.points1.map(p=>({x:p.x,y:1})),borderColor:'#94a3b8',borderDash:[4,4],pointRadius:0}];if(Number.isFinite(o.atMean1))ds.push({label:'Điểm Ω(μ₁='+riskFmt(o.mu1)+'R) = 1.00',data:[{x:o.mu1,y:o.atMean1}],backgroundColor:'#10b981',borderColor:'#10b981',pointRadius:6,pointStyle:'rectRot',showLine:false});if(o.n2)ds.push({label:'Ω(L) · '+o.two+' (n='+o.n2+')',data:o.points2,borderColor:'#d97706',pointRadius:0,borderDash:[5,3]});riskChart('risk-omega-chart','line',[],ds,{scales:{x:{type:'linear',title:{display:true,text:'Ngưỡng L (R)'}},y:{min:0,max:20}}});$('omega-stats').textContent=o.one+': Ω(L='+riskFmt(RiskStore.controls.L)+'R) = '+riskFmt(o.om1)+' · Ω(0) dùng chung = '+riskFmt(s.edge.omega0)+(o.n2?' · '+o.two+': Ω(L) = '+riskFmt(o.om2):'');$('omega-quantile-grid').innerHTML='<div class="text-[10px] font-bold">Lưới Phân Vị Lợi Nhuận P10 – P90 &amp; Giá Trị Ω(Q_p)</div><table class="w-full text-[10px] text-center border border-slate-200"><tr><th>Phân vị</th>'+o.quantiles.map(q=>'<th class="p-1 border">P'+q.q+'</th>').join('')+'</tr>'+[['Ngưỡng R','value'],['Ω₁(P_q)','om1'],['Ω₂(P_q)','om2']].filter((row,i)=>i<2||o.n2).map(([name,key])=>'<tr><th>'+name+'</th>'+o.quantiles.map(q=>'<td class="p-1 border">'+riskFmt(q[key])+'</td>').join('')+'</tr>').join('')+'</table>';
 const ta=s.tailAnalytics;$('es-stats').innerHTML='<div>ES 97,5% lệnh đơn '+tailDisplay(s)+'R · VaR 97,5% '+tailDisplay(s,'var975')+'R · CVaR 95% '+(s.advancedSummary.active.ready?riskFmt(s.advancedSummary.active.es95):'Chưa đủ mẫu')+'R · VaR 95% '+(s.advancedSummary.active.ready?riskFmt(s.advancedSummary.active.var95):'Chưa đủ mẫu')+'R</div><div>VaR 97,5% / VaR 99% (tổng 10 lệnh): '+riskFmt(ta.v975)+'R / '+riskFmt(ta.v99)+'R · ES mô phỏng 97,5% (10 lệnh; chưa có CI tham số): '+(s.advancedSummary.active.ready?riskFmt(ta.es):'Chưa đủ mẫu gốc')+'R</div><div>Cửa sổ trượt xấu nhất ('+ta.wn+' lệnh liên tiếp, '+ta.nwin+' cửa sổ): '+riskFmt(ta.worst)+'R</div><div>ES stressed ('+s.simConfig.tailWindow+' lệnh, ×'+s.simConfig.tailSlip+', LH '+riskFmt(s.liquidity.days,1)+' ngày): '+(s.advancedSummary.active.ready?riskFmt(ta.esS):'Chưa đủ mẫu gốc')+'R</div>';$('sample-size-warning-tag').textContent=s.advancedSummary.active.ready?'Đủ ngưỡng cấu hình · Net R':tailDisplay(s);$('var-breach-badge').textContent='Vi phạm VaR97.5: '+ta.a+'/'+ta.n+' lệnh · VaR99: '+ta.b+'/'+ta.n+' lệnh';riskChart('risk-tail-chart','bar',ta.bins.map((_,i)=>(ta.lo+i)+'R'),[{label:'Phân phối tổng 10 lệnh (VaR97.5='+riskFmt(ta.v975)+'R)',data:ta.bins,backgroundColor:ta.bins.map((_,i)=>ta.lo+i<=ta.v975?'#e11d48':'#64748b')}]);riskChart('chartVarBreachTimeline','line',ta.breachPts.map(p=>'T'+p.idx),[{label:'Actual R từng lệnh',data:ta.breachPts.map(p=>p.r),borderColor:'#2563eb',pointRadius:ta.breachPts.map(p=>p.b975?6:2.5),pointBackgroundColor:ta.breachPts.map(p=>p.b975?'#e11d48':'#2563eb')},{label:'Ngưỡng VaR 97.5% mở rộng',data:ta.breachPts.map(p=>p.v975),borderColor:'#e11d48',borderDash:[4,4],pointRadius:0},{label:'Ngưỡng VaR 99% mở rộng',data:ta.breachPts.map(p=>p.v99),borderColor:'#9f1239',borderDash:[2,2],pointRadius:0}]);
 $('risk-decay-stats').textContent='So Sánh 1/2 Đầu vs 1/2 Sau Dữ Liệu: '+riskFmt(d.rolling.first)+'R → '+riskFmt(d.rolling.last)+'R';riskChart('risk-drift-chart','line',d.rolling.points.map(x=>x.date),[{label:'Rolling Expectancy',data:d.rolling.points.map(x=>x.mean),borderColor:'#2563eb',pointRadius:0},{label:'Rolling SQN',data:d.rolling.points.map(x=>x.sqn),borderColor:'#d97706',pointRadius:0}]);
 const e=d.exit;$('adv-exit-bounds').innerHTML='<b>What-If: ranh giới kết quả có thể chứng minh</b><p>Chỉ chạm TP: <b>'+e.tpOnly+'</b>; chỉ chạm SL: <b>'+e.slOnly+'</b>; có thể chạm cả hai: <b>'+e.both+'</b>. Chỉ riêng MAE/MFE không xác định thứ tự chạm, vì vậy chưa thể tính Win Rate/Expectancy của phương án mới.</p><p class="text-xs text-amber-700 mt-1">Để backtest exit 2R/trailing chuẩn cần chuỗi nến/tick trong thời gian lệnh.</p>';
 const trailing=$('whatif-scenario-select').value==='trailing_mfe';riskChart('chartWhatIfCompare','bar',['Actual','Cận dưới (SL trước)','Cận trên (TP trước)'],[{label:trailing?'Trailing: chưa đủ đường đi giá':'Khoảng kỳ vọng theo giả định TP/SL',data:trailing?[e.actual,null,null]:[e.actual,e.lower,e.upper],backgroundColor:['#94a3b8','#e11d48','#2563eb']}]);$('l2-planned-vs-actual-card').innerHTML=riskStat('Expectancy theo tiền ($)',riskMoney(s.edge.expectancyUsd))+riskStat('Planned RR → Actual R',riskFmt(d.plan.planned)+'R → '+riskFmt(s.edge.expectancy)+'R',d.plan.n+' lệnh có giá kế hoạch')+riskStat('Lệch Planned RR vs Actual R',riskFmt(d.plan.gap)+'R');$('l2-tail-setup-alert').innerHTML='<b>Setup Rủi Ro Đuôi Cao:</b> '+(d.setups.filter(x=>x.highTailRisk).map(x=>E(x.name)).join(', ')||'Chưa phát hiện trong mẫu đang lọc')+'.';}
function renderRiskOpt(){const s=RiskStore.read(),r=s.rck,d=s.details,base=state.riskProfile.assumptions.rckMode==='binary'?s.binary:s.empirical;$('out-full-kelly').textContent=riskPct(base.kelly)+' / lệnh';$('out-half-kelly').textContent=riskPct(base.kelly*.5)+' / lệnh';$('out-quarter-kelly').textContent=riskPct(base.kelly*.25)+' / lệnh';$('out-rck-optimal').textContent=riskPct(r.f)+' / lệnh';$('out-final-rec').textContent=riskPct(s.recommendation)+' / lệnh';$('rck-extra').textContent='Chế độ đang chọn: '+(state.riskProfile.assumptions.rckMode==='empirical'?'Phân phối Thực nghiệm Đầy đủ':'Xấp xỉ Nhị phân')+' · N '+s.edge.n+' · Thực nghiệm: Kelly '+riskPct(s.empirical.kelly)+', RCK '+riskPct(s.empirical.f)+' · Thực nghiệm robust η='+riskFmt(s.rck.eta,3)+': '+riskPct(s.empiricalRobust.f)+' · Nhị phân robust η='+riskFmt(s.binary.eta,3)+': '+riskPct(s.binary.f)+' · Trần Tier/ngày '+riskPct(s.equity>0?s.budget/s.equity:0)+' · RoR<1% '+(s.rorCap===null?'chưa kiểm chứng':riskPct(s.rorCap));$('adv-rck').textContent='λ = log(β) / log(α) = '+riskFmt(r.lambda)+' · Đề xuất dùng chung = '+riskPct(s.recommendation);$('risk-opt-result').textContent=!s.gates.pass?'Cổng liên động đang khóa. Đề xuất = 0.':s.verificationPending?'Chưa kiểm chứng RoR Monte Carlo < 1%; đề xuất = 0 cho đến khi chạy.':'Đã tính theo Risk Profile và các ràng buộc đã kiểm chứng.';
 const a=Array.from({length:10},(_,i)=>5*(i+1)),ds=(l,lambda,color,dash=[])=>({label:l,data:a.map(dd=>Math.pow(1-dd/100,lambda)*100),borderColor:color,borderDash:dash,pointRadius:0});riskChart('chartRckFam','line',a.map(x=>x+'%'),[ds('λ hiện tại = '+riskFmt(r.lambda,1),r.lambda,'#2563eb'),ds('λ=2',2,'#94a3b8',[4,4]),ds('λ=4',4,'#94a3b8',[4,4]),ds('λ=8',8,'#94a3b8',[4,4]),{label:'β đã chọn',data:a.map(()=>(state.riskProfile.rckAlpha??.05)*100),borderColor:'#e11d48',borderDash:[2,2],pointRadius:0}],{scales:{y:{max:100,title:{display:true,text:'P(chạm sàn) ≤ α^λ (%)'}},x:{title:{display:true,text:'Mức DD'}}}});
 $('adv-serial-complete').innerHTML='<b>Ma trận tâm lý chuỗi (dữ liệu nhật ký)</b><p class="text-xs mb-2">Baseline E = '+riskFmt(s.edge.expectancy)+'R · mẫu quá nhỏ không đủ để kết luận hành vi.</p><div class="grid grid-cols-1 lg:grid-cols-3 gap-2">'+[['loss1','Sau 1 lệnh lỗ'],['loss2','Sau ≥ 2 lệnh lỗ'],['bigwin','Sau thắng lớn ≥ 2,5R']].map(([k,name])=>{const a=d.serial[k];return riskStat(name,a.n+' lệnh','Expectancy '+riskFmt(a.exp)+'R · WR '+riskPct(a.win)+' · Vi phạm '+a.violations+'/'+a.n+' · Khoảng nghỉ '+riskFmt(a.pause)+'p');}).join('')+'</div>';$('risk-opt-fan-note').textContent=s.mc?'Kết quả Monte Carlo đã có trong RiskStore.':'Chưa chạy Monte Carlo. Mở trang Mô phỏng & Stress Lab.';}
async function verifyRiskRecommendation(){const s=RiskStore.read();if(!s.gates.pass)return;const seq=++riskVerifySerial,key=s.verificationKey;$('risk-opt-result').textContent='Đang kiểm chứng RoR Monte Carlo < 1% trong Worker…';$('risk-opt-run').disabled=true;try{const job=await RiskStore.job('analytics',{verifyRisk:true,R:s.edge.returns,floor:RiskStore.controls.floor,runs:1000,horizon:RiskStore.controls.horizon,seed:20260101});if(!job.stale&&seq===riskVerifySerial&&RiskStore.read().verificationKey===key){RiskStore.verified=job.result.cap;RiskStore.verificationKey=key;RiskStore.revision=-1;renderRiskHeader();renderVisiblePage();}}catch(error){toast(error.message);}finally{$('risk-opt-run').disabled=!RiskStore.read().gates.pass;}}
async function runTierRecovery(){const s=RiskStore.read(),sequence=++recoverySequence;if(!s.details.recentReturns.length)return toast('Chưa đủ lệnh R đã xác minh');const button=$('tier3-recovery-run');if(button){button.disabled=true;button.textContent='Đang mô phỏng phục hồi…';}try{const job=await RiskStore.job('mc',{purpose:'recovery',R:s.details.recentReturns,options:{runs:10000,horizon:40,riskPct:.5,ddLimit:.15},seed:202603});if(!job.stale&&sequence===recoverySequence){renderVisiblePage();}}catch(error){toast(error.message);}finally{if($('tier3-recovery-run'))$('tier3-recovery-run').disabled=false;}}
function renderPerf(){const s=RiskStore.read();$('perf-grid').innerHTML=riskStat('STARR',s.advancedSummary.all_trades.ready&&!state.grossMode&&s.inputs.advanced.R.length===s.edge.n?riskFmt(s.details.perf.starr):'Chưa đủ mẫu Net R')+riskStat('Rachev',s.advancedSummary.all_trades.ready&&s.inputs.advanced.R.length*.01>=s.advancedConfig.tailMinMass&&!state.grossMode&&s.inputs.advanced.R.length===s.edge.n?riskFmt(s.details.perf.rachev):'Chưa đủ mẫu đuôi 1%')+riskStat('Break-Even WR',riskPct(s.details.perf.breakEven));}
function renderRiskPages(key){renderRiskHeader();if(key==='cockpit')renderCockpit();if(key==='riskcapital')renderCapital();if(key==='riskedge')renderRiskEdge();if(key==='riskopt')renderRiskOpt();if(key==='pnlrisk')renderPerf();}
function previewTradeMetrics(){if(!$('trade-metrics-preview'))return;const t={symbol:$('risk-edit-symbol').value,side:$('risk-edit-side').value,entryPrice:$('risk-edit-entry').value,slPrice:$('risk-edit-sl').value,tpPrice:$('risk-edit-tp').value,exitPrice:$('risk-edit-exit').value,openTime:$('risk-edit-open').value,closeTime:$('risk-edit-close').value,exitReason:$('risk-edit-exit-reason').value,slippage:$('adv-edit-slip').value,tickSize:$('adv-edit-tick').value},m=RiskMath.calcTradeMetrics(t);$('trade-metrics-preview').textContent='Planned RR '+riskFmt(m.plannedRR)+' · Actual R '+riskFmt(m.actualR)+' · Thời gian giữ '+riskFmt(m.durationHours)+' giờ · Pips/Ticks '+riskFmt(m.pipDiff)+' · Trượt giá '+riskFmt(m.slippageR)+'R ('+m.exitReason+')';if($('risk-edit-auto-pnl').checked&&Number.isFinite(m.actualR)&&Number($('risk-edit-risk').value)>0)$('risk-edit-pnl').value=(m.actualR*Number($('risk-edit-risk').value)).toFixed(8);const s=RiskStore.read();$('modal-tier-note').textContent=s.tier===2?'Tier 2: khối lượng mặc định giảm 50%; Max Risk / Trade '+riskMoney(s.budget):s.tier===3?'Tier 3: khuyến nghị dừng giao dịch thực tế; vẫn ghi nhận nhật ký.':'';$('modal-setup-tier2-hint').textContent=s.tier===2?'Tier 2: Ưu tiên Setup hạng A ('+s.details.setups.filter(x=>x.isGradeA).map(x=>x.name).join(', ')+').':'';AdaptiveTradeForm.preview();}
function bindRiskEvents(){
 $('risk-ror-horizon').addEventListener('change',()=>{const horizon=Number($('risk-ror-horizon').value);if(Number.isInteger(horizon)&&horizon>=10&&horizon<=500)updateRiskControls({horizon});else toast('Số lệnh giả lập từ 10 đến 500');});
 $('journal-column-groups').addEventListener('click',e=>{const button=e.target.closest('[data-columns]');if(!button)return;journalColumnGroup=button.dataset.columns;renderWorkspaceTable(lastDataset);});
 for(const id of Object.keys(profileInputs)){const el=$(id);if(el&&!el.hasAttribute('onchange'))el.addEventListener('change',()=>tierCfg('manual'));}
 for(const id of ['adv-rck-alpha','adv-rck-beta'])$(id).addEventListener('change',()=>writeData(d=>{d.riskProfile.rckAlpha=Number($('adv-rck-alpha').value)/100;d.riskProfile.rckBeta=Number($('adv-rck-beta').value)/100;}));
 $('risk-roll-window').addEventListener('change',()=>updateRiskControls({window:Number($('risk-roll-window').value)}));for(const id of ['risk-tp-r','risk-sl-r'])$(id).addEventListener('change',()=>{const tp=Number($('risk-tp-r').value),sl=Number($('risk-sl-r').value);if(tp>0&&sl>0)updateRiskControls({tp,sl});});
 $('risk-detail-modal').addEventListener('input',previewTradeMetrics);$('risk-detail-modal').addEventListener('change',previewTradeMetrics);$('risk-detail-modal').addEventListener('change',event=>AdaptiveTradeForm.change(event));
 const empirical=document.createElement('button');empirical.type='button';empirical.className='border rounded px-3 py-1.5 text-xs';empirical.textContent='Chạy RoR thực nghiệm';empirical.onclick=runEmpiricalRor;$('ror-emp').parentElement.appendChild(empirical);
 $('tab-cockpit').addEventListener('change',e=>{const el=e.target;if(el.dataset.position){const value=Number(el.value);if(!Number.isFinite(value)||el.dataset.key==='initialRisk'&&value<0)return toast('Giá trị không hợp lệ');writeData(d=>{const t=d.openPositions.find(t=>String(t.id)===el.dataset.position);if(t)t[el.dataset.key]=value;});}});$('tab-cockpit').addEventListener('click',e=>{const el=e.target.closest('[data-remove-position]');if(el)writeData(d=>d.openPositions=d.openPositions.filter(t=>String(t.id)!==el.dataset.removePosition));});
}


function renderRorHeatmap(Wcur, bCur, f, fl) {
  let ws = [], bs = [];
  if (state.riskProfile.assumptions.rorZoom) {
    const w0 = Math.round(Wcur * 100);
    for (let dw = -4; dw <= 4; dw++) ws.push(Math.min(95, Math.max(10, w0 + dw)));
    for (let db = -3; db <= 3; db++) bs.push(Math.max(0.4, +(bCur + db * 0.1).toFixed(2)));
  } else {
    ws = [35, 40, 45, 50, 55, 60, 65, 70];
    bs = [0.8, 1.0, 1.5, 2.0, 2.5, 3.0];
  }
  let h = '<table class="w-full text-center text-[10px] border-collapse"><tr><th class="p-1 bg-slate-100 border">W↓ \\ b→</th>' + bs.map(b => `<th class="p-1 bg-slate-100 border">${riskFmt(b, state.riskProfile.assumptions.rorZoom ? 2 : 1)}</th>`).join('') + '</tr>';
  ws.forEach(w => {
    h += `<tr><th class="p-1 bg-slate-50 border">${w}%</th>` + bs.map(b => {
      const p = RiskMath.rorAnalytic(w / 100, b, fl, f);
      const isCur = Math.abs(w - Wcur * 100) <= (state.riskProfile.assumptions.rorZoom ? 0.6 : 2.6) && Math.abs(b - bCur) <= (state.riskProfile.assumptions.rorZoom ? 0.06 : 0.26);
      return `<td class="p-1 border ${isCur ? 'ring-2 ring-blue-700 font-black' : ''}" style="background:hsl(${120 * (1 - Math.min(1, p * 4))},65%,80%)" title="W=${w}%, b=${b} -> RoR=${riskFmt(p*100,2)}%">${p < .0005 ? '&lt;0.1' : riskFmt(p * 100, 1)}${isCur ? ' ★' : ''}</td>`;
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

function renderTierProtocol(){const s=RiskStore.read(),recent=s.details.recent,aSetups=s.details.setups.filter(x=>x.isGradeA).map(x=>({...x,name:E(x.name)})),tailSetups=s.details.setups.filter(x=>x.highTailRisk).map(x=>({...x,name:E(x.name)})),pf10=s.details.recent10.pf,pf15=recent.pf,viol15=s.details.recentViolations,w15={length:recent.win*recent.n},last15={length:recent.n},needRecPct=s.details.recovery*100,p50Rec=s.recovery?s.equity*(1+s.recovery.med):NaN,p95Rec=s.recovery?s.equity*(1+s.recovery.p95):NaN,targetEq=s.equity*(1+s.details.recovery),passStatus=pf10>=1.2&&pf15>=1.2?'ĐẠT NGƯỠNG PHỤC HỒI (PF ≥ 1.20)':'CHƯA ĐẠT (PF < 1.20 — Cần giao dịch Demo/Paper)';$('tier2-action-panel').innerHTML=`
      <div class="flex items-center justify-between font-bold text-xs">
        <span>⚡ GIAO THỨC TIER 2 ĐÃ KÍCH HOẠT TỰ ĐỘNG</span>
        <span class="bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px]">Khóa B/C &amp; Tail-Risk Setup</span>
      </div>
      <div class="text-[11px] space-y-1">
        <div>• <b>Số lệnh đệm trước Tier 3:</b> ${s.tierContext.before??"–"} → ${s.tierContext.after??"–"} lệnh sau khi giảm 50% size (ngân sách còn lại $${riskFmt(s.tierContext.bufferUsd)}, rủi ro/lệnh $${riskFmt(s.tierContext.fullRisk)} → $${riskFmt(s.tierContext.halfRisk)}; giữ vốn cố định, chưa tính thay đổi NAV).<br>• <b>Giới hạn Playbook hạng A:</b> Chỉ cho phép giao dịch <b>${aSetups.map(s => `${s.name} (Exp +${riskFmt(s.mu)}R, PF ${riskFmt(s.pf)})`).join(', ') || 'Không có'}</b>.</div>
        <div>• <b>Setup bị loại khỏi danh sách A-Setup do Rủi Ro Đuôi Cao:</b> <b class="text-rose-700">${tailSetups.map(item => `${item.name} (${setupTailDisplay(s,item.name)})`).join(', ') || 'Không có'}</b>.</div>
        <div class="p-2 bg-white/80 rounded border border-amber-200 mt-1">
          <b>Bộ Chẩn Đoán Tự Động 15 Lệnh Gần Nhất:</b> Win Rate <b>${riskFmt(w15.length/last15.length*100,1)}%</b> · Expectancy <b>${riskFmt(recent.exp)}R</b> · Profit Factor <b>${riskFmt(pf15)}</b> · Vi phạm kỷ luật <b>${viol15}/${last15.length} lệnh</b>.
        </div>
      </div>
    `;$('tier3-action-panel').innerHTML=`
      <div class="flex items-center justify-between font-bold text-xs">
        <span>🚨 GIAO THỨC TIER 3 (CIRCUIT BREAKER) — KIỂM ĐỊNH PHỤC HỒI</span>
        <span class="bg-rose-200 text-rose-900 px-2 py-0.5 rounded text-[10px]">${passStatus}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-[11px]">
        <div class="p-2 bg-white rounded border border-rose-200">
          <span class="text-slate-500 block text-[10px]">Profit Factor 10 &amp; 15 Lệnh Cuối</span>
          <b>PF(10) = ${riskFmt(pf10)} · PF(15) = ${riskFmt(pf15)}</b>
          <span class="block text-[10px] text-slate-500">Kỳ vọng 10 lệnh: ${riskFmt(s.details.recent10.exp)}R | 15 lệnh: ${riskFmt(recent.exp)}R</span>
        </div>
        <div class="p-2 bg-white rounded border border-rose-200">
          <span class="text-slate-500 block text-[10px]">Monte Carlo Phục Hồi (40 lệnh @ 0.5% risk)</span>
          <b>P50: $${riskFmt(p50Rec,0)} · P95: $${riskFmt(p95Rec,0)}</b>
          <span class="block text-[10px] text-slate-500">Đỉnh cần lấy lại: $${riskFmt(targetEq,0)} (+${riskFmt(needRecPct,2)}%)</span>
        </div>
      </div>
      <div class="text-[11px]">Khuyến nghị: Chỉ mở khóa về Tier 2 khi PF(10–15 lệnh) ≥ 1.20 trên tài khoản Paper hoặc nạp/cấu hình lại vốn sau kỳ nghỉ bắt buộc.</div>
    `+ '<button id="tier3-recovery-run" type="button" onclick="runTierRecovery()" class="px-3 py-1.5 border rounded text-xs font-bold">Chạy Monte Carlo phục hồi</button><p class="text-[11px]">Mô phỏng giả định 0,5% cho Paper; đề xuất giao dịch thật vẫn bằng 0 khi cổng đóng.</p>';if(s.tier===3&&!s.recovery){const key=s.revision+':'+RiskStore.selectionVersion;if(recoveryRequestedKey!==key){recoveryRequestedKey=key;setTimeout(runTierRecovery,0);}}}

const PROP_PRESETS={"ftmo": {"n": "FTMO 100k (2-Step)", "size": 100000, "fee": 540, "actFee": 0, "stages": [10, 5], "ml": 10, "dl": 5, "tr": 0, "sp": 80, "pDays": 10}, "top": {"n": "Topstep 100k (1-Step + ActFee)", "size": 100000, "fee": 165, "actFee": 149, "stages": [6], "ml": 3, "dl": 0, "tr": 1, "sp": 90, "pDays": 10}, "apex": {"n": "Apex 100k (1-Step + ActFee)", "size": 100000, "fee": 147, "actFee": 130, "stages": [6], "ml": 3, "dl": 0, "tr": 1, "sp": 90, "pDays": 10}, "t5_high": {"n": "The5ers High Stakes 100k (2-Step)", "size": 100000, "fee": 495, "actFee": 0, "stages": [8, 5], "ml": 10, "dl": 5, "tr": 0, "sp": 80, "pDays": 10}, "t5_hyper": {"n": "The5ers Hyper Growth 20k (1-Step)", "size": 20000, "fee": 260, "actFee": 0, "stages": [10], "ml": 6, "dl": 3, "tr": 0, "sp": 80, "pDays": 10}, "t5_boot": {"n": "The5ers Bootcamp 100k (3-Step)", "size": 100000, "fee": 95, "actFee": 205, "stages": [6, 6, 6], "ml": 5, "dl": 0, "tr": 0, "sp": 80, "pDays": 10}, "mffx": {"n": "MyFundedFX 100k (2-Step)", "size": 100000, "fee": 499, "actFee": 0, "stages": [8, 5], "ml": 8, "dl": 5, "tr": 0, "sp": 80, "pDays": 10}, "fnext": {"n": "FundedNext Stellar 100k (2-Step)", "size": 100000, "fee": 519, "actFee": 0, "stages": [8, 5], "ml": 10, "dl": 5, "tr": 0, "sp": 80, "pDays": 10}};
const proStat=(label,value,note='')=>riskStat(label,value,note,'source');
const SIM_FIELDS={'sim-horizon':'horizon','sim-runs':'runs','sim-risk':'risk','sim-dd':'dd','sim-skip':'skip','sim-cap':'cap','sim-slip':'slip','sel-mc-mode':'mode','sel-mc-seed':'seed','chk-mc-revenge-mode':'revenge','sel-slip':'tailSlip','sel-win':'tailWindow','sel-lh':'liquidity'};
const STRESS_FIELDS={'adv-sw':'winrate','adv-sp':'payoff','adv-sf':'risk','adv-stress-dd':'dd','adv-streak':'streak','adv-degrade':'degrade','adv-tail':'tail','rng-stress-streak-len':'streakLength','rng-stress-wr-drop':'wrDrop','rng-stress-rr-drop':'rrDrop'};
const PROP_FIELDS={'adv-preset':'preset','adv-p-size':'size','adv-p-fee':'fee','adv-p-target':'stages','adv-p-maxloss':'ml','adv-p-daily':'dl','adv-p-risk':'risk','adv-p-split':'split','adv-p-tpd':'tpd','adv-p-horizon':'horizon','adv-p-ddmode':'ddMode','adv-p-runs':'runs','adv-p-seed':'seed','pf-actfee':'actFee','pf-comp':'comp','pf-pdays':'payoutDays','pf-ft':'fundedH','pf-month-days':'tradingDays'};
const SIZER_FIELDS={'adv-symbol':'symbol','adv-risk':'risk','adv-entry':'entry','adv-sl':'sl','adv-ptv':'pointValue','adv-step':'step'};
let p5Timer=null;
const p5Messages={simulation:'',prop:'',stress:''};
function syncP5Controls(){const s=RiskStore.read();for(const [map,cfg] of [[SIM_FIELDS,s.simConfig],[STRESS_FIELDS,s.stressConfig],[PROP_FIELDS,s.propConfig],[SIZER_FIELDS,s.sizerConfig]])for(const [id,key] of Object.entries(map)){const el=$(id);if(!el||document.activeElement===el)continue;if(el.type==='checkbox')el.checked=Boolean(cfg[key]);else el.value=key==='stages'?cfg.stages.join(', '):key==='comp'?(cfg.comp?'1':'0'):cfg[key]??'';}for(const [id,value] of Object.entries({'stress-streak-label':s.stressConfig.streakLength,'adv-sw-label':s.stressConfig.winrate+'%','adv-sp-label':s.stressConfig.payoff+'R','adv-sf-label':s.stressConfig.risk+'%','lbl-streak-len':s.stressConfig.streakLength+' lệnh','lbl-wr-drop':'-'+s.stressConfig.wrDrop+'%','lbl-rr-drop':'-'+s.stressConfig.rrDrop+'%'}))$(id).textContent=value;}
function collectP5(map,base){const cfg={...base};for(const [id,key] of Object.entries(map)){const el=$(id);if(!el)continue;if(el.type==='checkbox')cfg[key]=el.checked;else if(key==='stages'){const parts=el.value.split(',').map(x=>x.trim());if(!parts.length||parts.some(x=>x===''||!Number.isFinite(Number(x))))throw new Error('Nhập 1–3 mục tiêu giai đoạn hợp lệ, cách nhau bởi dấu phẩy');cfg[key]=parts.map(Number);}else if(key==='comp')cfg[key]=el.value==='1';else if(['mode','liquidity','preset','ddMode','symbol'].includes(key))cfg[key]=el.value;else if(key==='cap'&&el.value==='')cfg[key]=null;else{cfg[key]=Number(el.value);if(!Number.isFinite(cfg[key]))throw new Error('Giá trị không hợp lệ: '+id);}}return cfg;}
function validateP5(kind,cfg){return Core.checkConfig(kind,cfg);}
function saveP5Config(kind,cfg){validateP5(kind,cfg);const defaults={sim:SIM_DEFAULTS,stress:STRESS_DEFAULTS,propConfig:PROP_DEFAULTS,sizer:SIZER_DEFAULTS}[kind],current={...defaults,...state.extra[kind]};if(JSON.stringify(current)!==JSON.stringify(cfg))return writeData(d=>d.extra[kind]=cfg);return true;}
function runSimulation(){try{if(!saveP5Config('sim',collectP5(SIM_FIELDS,RiskStore.read().simConfig)))return;ensureSimulationJobs();}catch(error){toast(error.message);}}
function stress(){clearTimeout(p5Timer);p5Timer=setTimeout(()=>{try{const s=RiskStore.read();if(!s.gates.stress)return;const sim=validateP5('sim',collectP5(SIM_FIELDS,s.simConfig)),scenario=validateP5('stress',collectP5(STRESS_FIELDS,s.stressConfig));if(JSON.stringify(sim)!==JSON.stringify(s.simConfig)||JSON.stringify(scenario)!==JSON.stringify(s.stressConfig)){if(!writeData(d=>{d.extra.sim=sim;d.extra.stress=scenario;}))return;}ensureStressJob();}catch(error){toast(error.message);}},120);}
function saveLiquidity(){try{saveP5Config('sim',collectP5(SIM_FIELDS,RiskStore.read().simConfig));}catch(error){toast(error.message);}}
function propSimulation(){try{if(!saveP5Config('propConfig',collectP5(PROP_FIELDS,RiskStore.read().propConfig)))return;ensurePropJob();}catch(error){toast(error.message);}}
function syncSizerSymbol(){const symbol=$('adv-symbol').value,[pointValue,step]=PRODUCT_SPECS[symbol]||[1,.01];$('adv-ptv').value=state.currency==='VND'?'':pointValue||'';$('adv-step').value=step;calcSizer();}
function calcSizer(){try{saveP5Config('sizer',collectP5(SIZER_FIELDS,RiskStore.read().sizerConfig));renderSizer();}catch(error){toast(error.message);}}
function propPreset(){const key=$('adv-preset').value,p=PROP_PRESETS[key];let cfg={...RiskStore.read().propConfig,preset:key};if(p)Object.assign(cfg,{size:p.size,fee:p.fee,actFee:p.actFee||0,stages:p.stages.slice(),ml:p.ml,dl:p.dl,split:p.sp,payoutDays:p.pDays||10,ddMode:p.tr?'trailing':'static'});if(key==='exampleA')Object.assign(cfg,{stages:[8],ml:10,dl:5,fee:500,ddMode:'static'});if(key==='exampleB')Object.assign(cfg,{stages:[6],ml:5,dl:0,fee:165,ddMode:'trailing'});saveP5Config('propConfig',cfg);}
async function runP5Job(task,payload,label){try{const result=await RiskStore.job(task,payload);p5Messages[label]='';renderP5Results();if(result.stale){const key=document.body.dataset.page;if(key==='simulation'){ensureSimulationJobs();ensureStressJob();}if(key==='riskprop')ensurePropJob();}return result;}catch(error){p5Messages[label]=error.message;renderP5Results();return {stale:true,error:error.message};}}
function ensureSimulationJobs(){const s=RiskStore.read();if(s.inputs.pools.base.length<2)return;if(!s.mc&&!RiskStore.pendingJobs.has('mc'+JSON.stringify(s.inputs.mc)))runP5Job('mc',s.inputs.mc,'simulation');if(s.inputs.whatif&&s.inputs.pools.alternative.length>=2&&!s.whatif&&!RiskStore.pendingJobs.has('mc'+JSON.stringify(s.inputs.whatif)))runP5Job('mc',s.inputs.whatif,'simulation');}
function ensureStressJob(){const s=RiskStore.read();if(!s.gates.stress||s.stress)return;const payload=s.inputs.stress;if(!RiskStore.pendingJobs.has('mc'+JSON.stringify(payload)))runP5Job('mc',payload,'stress');}
function ensurePropJob(){const s=RiskStore.read();if(s.edge.n<10||s.prop)return;const payload=s.inputs.prop;if(!RiskStore.pendingJobs.has('prop'+JSON.stringify(payload)))runP5Job('prop',payload,'prop');}
function ensureComparison(){const s=RiskStore.read();if(s.inputs.pools.base.length<2||s.compare)return;const payload=s.inputs.compare;if(!RiskStore.pendingJobs.has('mc'+JSON.stringify(payload)))runP5Job('mc',payload,'simulation');}
function renderSimulationResults(){const s=RiskStore.read(),g=$,o={...s.simConfig,ddLimit:s.simConfig.dd/100},A=s.mc,B=s.inputs.whatif?s.whatif:null,out=$('sim-summary'),note=$('sim-note'),base=s.inputs.pools.base;
 if(base.length<2||(s.inputs.whatif&&s.inputs.pools.alternative.length<2)){if(charts.sim){charts.sim.destroy();delete charts.sim;}out.innerHTML='<p class="text-xs text-slate-500 py-6 text-center">Cần ít nhất 2 lệnh để mô phỏng. Nới lỏng bộ lọc hoặc điều kiện what-if.</p>';note.textContent='';$('mc-mdd').innerHTML='';return;}
 if(!A){out.textContent=p5Messages.simulation||'Đang mô phỏng trong Web Worker…';return;}
 const pc=v=>(v>0?'+':'')+(v*100).toFixed(1)+'%',pr=v=>(v*100).toFixed(0)+'%';
 const rows=[['Lợi nhuận trung vị',r=>pc(r.med)],['Khoảng 5% – 95%',r=>pc(r.p5)+' → '+pc(r.p95)],['Xác suất có lãi',r=>pr(r.win)],['Sụt giảm tối đa trung vị',r=>'-'+(r.ddMed*100).toFixed(1)+'%'],['Xác suất sụt giảm ≥ '+(o.ddLimit*100).toFixed(0)+'%',r=>pr(r.ddProb)]];

 out.innerHTML='<table class="w-full text-xs border-collapse tabular-nums"><thead><tr class="text-left text-slate-500 border-b border-slate-200"><th class="py-2 pr-3 font-semibold">Sau '+o.horizon+' lệnh, '+o.runs+' lần chạy</th><th class="py-2 px-3 text-right font-semibold">Hiện tại</th>'+(B?'<th class="py-2 pl-3 text-right font-semibold text-amber-700">What-if</th>':'')+'</tr></thead><tbody>'
                +rows.map(r=>'<tr class="border-b border-slate-100"><td class="py-2 pr-3">'+r[0]+'</td><td class="py-2 px-3 text-right font-semibold">'+r[1](A)+'</td>'+(B?'<td class="py-2 pl-3 text-right font-semibold text-amber-700">'+r[1](B)+'</td>':'')+'</tr>').join('')+'</tbody></table>';
 note.textContent='Dải nhạt là 5–95%, dải đậm là 25–75%, đường đậm là trung vị. '+(o.mode==='perm'?'Hoán vị chuỗi lệnh (không hoàn lại); xáo lại khi hết bộ lệnh.':'Mô phỏng lấy lại ngẫu nhiên '+base.length+' lệnh bạn đã có và giả định các lệnh độc lập.')+(o.revenge?' Stress chuỗi: lệnh sau thua có nguy cơ nhận thêm −0,5R (xác suất 25%, tình huống giả định).':'')+(base.length<30?' Mẫu dưới 30 lệnh: kết quả chỉ mang tính minh họa.':'');
 const lab=Array.from({length:o.horizon+1},(_,i)=>i),b=A.bands;
            const ds=[{data:b[0],borderWidth:0,pointRadius:0,fill:false},{data:b[4],borderWidth:0,pointRadius:0,backgroundColor:'rgba(37,99,235,0.10)',fill:'-1'},{data:b[1],borderWidth:0,pointRadius:0,fill:false},{data:b[3],borderWidth:0,pointRadius:0,backgroundColor:'rgba(37,99,235,0.22)',fill:'-1'},{label:'Trung vị hiện tại',data:b[2],borderColor:'#1d4ed8',borderWidth:2,pointRadius:0,fill:false}];
            if(B)ds.push({label:'Trung vị what-if',data:B.bands[2],borderColor:'#b45309',borderWidth:2,borderDash:[6,4],pointRadius:0,fill:false});
            charts.sim=ChartRegistry.draw('sim',g('chart-sim'),{type:'line',data:{labels:lab,datasets:ds},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{filter:i=>!!i.text}},tooltip:{filter:i=>!!i.dataset.label,callbacks:{label:c=>c.dataset.label+': '+c.parsed.y.toFixed(1)+'%'}}},scales:{x:{title:{display:true,text:'Số lệnh'}},y:{title:{display:true,text:'Thay đổi vốn (%)'},ticks:{callback:v=>v+'%'}}}}});
 $('mc-info').textContent=o.runs+' đường · '+o.horizon+' lệnh · '+(o.mode==='perm'?'Hoán vị':'Bootstrap')+' · risk '+o.risk+'% · seed '+o.seed+' · '+(s.gates.pass?'Cổng đủ điều kiện':'Cổng đề xuất đang khóa; đây là kịch bản giả định, không thay mức đề xuất 0%');
 const cl=x=>x>state.riskProfile.t3?'text-rose-700':x>state.riskProfile.t2?'text-amber-700':'text-emerald-700';$('mc-mdd').innerHTML='<div class="grid grid-cols-2 gap-2 text-center text-xs"><div class="p-2 bg-slate-50 border border-slate-200 rounded">Median Max Drawdown<br><b class="text-base '+cl(A.ddMed*100)+'">'+riskPct(A.ddMed)+'</b></div><div class="p-2 bg-rose-50 border border-rose-200 rounded">P95 Max Drawdown<br><b class="text-base '+cl(A.ddP95*100)+'">'+riskPct(A.ddP95)+'</b></div></div><p class="text-[10px] text-slate-500 mt-1">Max DD = sụt giảm đỉnh → đáy lớn nhất trên từng đường '+o.horizon+' lệnh, lấy trung vị và phân vị 95 qua '+o.runs+' đường. Màu so với ngưỡng Tier hiện hành ('+state.riskProfile.t2+'% / '+state.riskProfile.t3+'%).</p>';
}
function renderStressResults(){const s=RiskStore.read(),cfg=s.stressConfig,scenario=s.inputs.scenario,r=s.stress;$('stress-controls').disabled=!s.gates.stress;$('tail-stress-controls').disabled=!s.gates.stress;$('stress-lock-note').classList.toggle('hidden',s.gates.stress);$('stress-lock-note').textContent='Stress Lab đang khóa theo Safety / Edge / Sample Gate. Có thể thay giả định khóa tại Buồng lái.';
 const chip=(label,ok,value)=>'<div class="rounded-xl border-2 p-3 '+(ok?'bg-emerald-50 border-emerald-300':'bg-rose-50 border-rose-300')+'"><div class="text-xs font-semibold">'+label+'</div><b class="block mt-1">'+E(value)+'</b></div>';$('adv-stress-gates').innerHTML=chip('LỚP 1 · Vốn thực',s.gates.safety,'Tier '+s.tier+' / DD '+riskPct(s.dd))+chip('LỚP 2 · Lợi thế giả lập',scenario.expectancy>0&&scenario.omega0>1,'E '+riskFmt(scenario.expectancy)+'R · Ω '+riskFmt(scenario.omega0))+chip('LỚP 3 · Quy mô giả lập',s.gates.pass&&scenario.expectancy>0&&scenario.omega0>1,'RCK '+riskPct(s.recommendation)+' · '+(s.gates.pass&&scenario.expectancy>0&&scenario.omega0>1?'THĂM DÒ':'KHÓA'));
 if(!s.gates.stress||!r){$('adv-stress-out').textContent=!s.gates.stress?'Cổng liên động đang khóa.':p5Messages.stress||'Đang mô phỏng stress trong Worker…';if(charts['adv-stress-chart']){charts['adv-stress-chart'].destroy();delete charts['adv-stress-chart'];}return;}
 $('adv-stress-out').innerHTML='<div class="grid grid-cols-2 lg:grid-cols-4 gap-2">'+proStat('Trung vị P&L',riskPct(r.med))+proStat('Xác suất vượt DD',riskPct(r.ddProb),'Ngưỡng '+cfg.dd+'%')+proStat('Max DD P95',riskPct(r.ddP95))+proStat(cfg.streakLength+' lệnh lỗ liên tiếp',cfg.streak?riskPct(scenario.streakDD):'Chưa bật')+'</div><p class="text-xs mt-2">Risk '+cfg.risk+'% / lệnh, W '+riskPct(scenario.winrate)+', Payoff '+riskFmt(scenario.payoff)+'R. '+(cfg.tail?'Đã tăng lỗ: hệ số 2× cho 2,5% lệnh thua giả lập.':'')+' Gợi ý khóa chỉ là cảnh báo trong giao diện; không gửi thao tác sàn.</p>';
 riskChart('adv-stress-chart','line',r.bands[2].map((_,i)=>i),[0,2,4].map((i,j)=>({label:['P5','P50','P95'][j],data:r.bands[i],borderColor:['#e11d48','#2563eb','#10b981'][j],borderWidth:j===1?2.6:1,pointRadius:0})),{scales:{y:{title:{display:true,text:'% vốn so đầu kỳ'}}}});
}
function renderTailSummary(){const s=RiskStore.read(),t=s.tailAnalytics;$('sim-tail-summary').textContent='ES stressed ('+s.simConfig.tailWindow+' lệnh, trượt giá ×'+s.simConfig.tailSlip+', thanh khoản √('+riskFmt(s.liquidity.days,1)+'/10)): '+(s.advancedSummary.active.ready?riskFmt(t.esS):'Chưa đủ mẫu gốc')+'R · '+(state.riskProfile.assumptions.tail25Mode==='losing_only'?'2,5% nhóm lệnh thua':'2,5% toàn bộ lệnh')+' · '+t.rSk+'/'+t.rSL+' lệnh · ES 97,5% lệnh đơn '+tailDisplay(s)+'R';}
function renderRiskCompare(){const s=RiskStore.read(),el=$('risk-compare');if(!s.compare){el.textContent=s.edge.n<2?'Cần ít nhất 2 lệnh R để so sánh.':'Đang so sánh các mức rủi ro trong Worker…';ensureComparison();return;}const cfg=s.simConfig,cl=x=>x>state.riskProfile.t3?'text-rose-700 font-bold':x>state.riskProfile.t2?'text-amber-700 font-bold':'text-emerald-700';el.innerHTML='<div class="font-bold text-slate-800 mt-3 mb-1">So sánh các mức rủi ro/lệnh (cùng seed, cùng chuỗi ngẫu nhiên, '+cfg.horizon+' lệnh, '+Math.min(5000,cfg.runs)+' đường)</div><div class="overflow-x-auto"><table class="w-full text-xs text-right"><tr class="bg-slate-100"><th class="p-1.5 text-left">Risk/lệnh</th><th class="p-1.5">Lãi/lỗ trung vị</th><th class="p-1.5">P5 (xấu)</th><th class="p-1.5">Median Max DD</th><th class="p-1.5">P95 Max DD</th><th class="p-1.5">RoR (chạm −'+cfg.dd+'%)</th></tr>'+s.compare.map(x=>{const r=x.result,rec=s.recommendation>0&&Math.abs(x.risk-s.recommendation*100)<1e-9;return '<tr class="border-t '+(rec?'bg-blue-50 font-bold':'')+'"><td class="p-1.5 text-left">'+riskFmt(x.risk)+'% '+(rec?'<span class="text-[10px] text-blue-700">(khuyên dùng)</span>':'')+'</td><td class="p-1.5">'+riskPct(r.med)+'</td><td class="p-1.5">'+riskPct(r.p5)+'</td><td class="p-1.5 '+cl(r.ddMed*100)+'">'+riskPct(r.ddMed)+'</td><td class="p-1.5 '+cl(r.ddP95*100)+'">'+riskPct(r.ddP95)+'</td><td class="p-1.5">'+riskPct(r.ddProb)+'</td></tr>';}).join('')+'</table></div><p class="text-[10px] text-slate-500">Đỏ: P95 Max DD vượt ngưỡng Tier 3 ('+state.riskProfile.t3+'%) · hổ phách: vượt Tier 2 ('+state.riskProfile.t2+'%). Cùng seed nên các dòng chỉ khác nhau ở mức rủi ro, không do nhiễu ngẫu nhiên.</p>';}
function renderFeedback(){const s=RiskStore.read(),sg=s.feedback;if(!sg){$('fb-l1').innerHTML='<h3 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">7. Hạn Mức Drawdown Đề Xuất Từ Lớp 3</h3><p class="text-slate-600">Chưa có mô phỏng khả dụng ở mức rủi ro khuyên dùng. '+(s.gates.pass?'Chờ kiểm chứng RCK/RoR và Monte Carlo cùng mức risk.':'Lớp 3 đang khóa nên mức rủi ro khuyên dùng = 0%.')+'</p>'+(s.recommendation>0?'<button onclick="useRecommendedSimulation()" class="px-3 py-1.5 bg-slate-800 text-white font-bold rounded">Mô phỏng theo mức khuyên dùng</button>':'');return;}const prop=state.riskProfile.acct==='prop',MCRES={f:s.recommendation,H:s.simConfig.horizon,perm:s.simConfig.mode==='perm',seed:s.simConfig.seed,med:s.mc.ddMed*100,p95:s.mc.ddP95*100},ST={dd:s.dd*100,t2:state.riskProfile.t2,t3:state.riskProfile.t3},out=ST.dd>MCRES.p95;$('fb-l1').innerHTML=`<h3 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">7. Hạn Mức Drawdown Đề Xuất Từ Lớp 3</h3>
<p>Ở mức rủi ro khuyên dùng <b>${riskFmt(MCRES.f*100,2)}%</b>, Monte Carlo (${MCRES.H} lệnh, ${MCRES.perm?'hoán vị':'bootstrap'}, seed ${MCRES.seed??'ngẫu nhiên'}) cho Median Max DD <b>${riskFmt(MCRES.med)}%</b> và P95 Max DD <b>${riskFmt(MCRES.p95)}%</b>.</p>
<div class="grid grid-cols-2 gap-2"><div class="p-2 bg-amber-50 border border-amber-200 rounded">Đề xuất Tier 2 (≈ Median MDD)<br><b class="text-base">${riskFmt(sg.t2,1)}%</b> <span class="text-slate-500">(hiện ${ST.t2}%)</span></div><div class="p-2 bg-rose-50 border border-rose-200 rounded">Đề xuất Tier 3 (≈ P95 MDD)<br><b class="text-base">${riskFmt(sg.t3,1)}%</b> <span class="text-slate-500">(hiện ${ST.t3}%)</span></div></div>
<div class="p-2 rounded border ${out?'bg-rose-50 border-rose-300 text-rose-900':'bg-slate-50 border-slate-200'}">Drawdown thực <b>${riskFmt(ST.dd)}%</b> ${out?'đã <b>vượt P95</b> của mô phỏng: kết quả thực tế xấu hơn 95% kịch bản, cần nghi ngờ edge đã suy giảm.':'nằm trong vùng P95 của mô phỏng.'}</div>
<button onclick="applyFeedback()" ${prop?'disabled':''} class="px-3 py-1.5 bg-slate-800 text-white font-bold rounded ${prop?'opacity-50 cursor-not-allowed':''}">Áp dụng đề xuất vào ngưỡng Tier</button>
<p class="text-[10px] text-slate-500">${prop?'Tài khoản Quỹ Prop dùng ngưỡng cố định 2,0% / 3,5%: chỉ tham khảo, không áp dụng.':'Không tự động áp dụng để tránh vòng lặp (ngưỡng Tier → rủi ro khuyên dùng → mô phỏng → ngưỡng Tier). Bấm nút để chấp nhận.'}</p>`;}
function useRecommendedSimulation(){const s=RiskStore.read();if(!(s.recommendation>0))return;saveP5Config('sim',{...s.simConfig,risk:s.recommendation*100});ensureSimulationJobs();}
function applyFeedback(){const s=RiskStore.read();if(!s.feedback||state.riskProfile.acct==='prop')return;writeData(d=>{d.riskProfile.t2=s.feedback.t2;d.riskProfile.t3=s.feedback.t3;});}
function renderPropResults(){const s=RiskStore.read(),cfg=s.propConfig,r=s.prop;if(s.edge.n<10){$('pf-out').innerHTML='<b class="text-rose-700">Cần ≥ 10 lệnh đủ R, hãy vào nhật ký kiểm tra 1R trước.</b>';return;}if(!r){$('pf-out').textContent=p5Messages.prop||'Đang mô phỏng thử thách đa giai đoạn trong Web Worker…';return;}const stages=cfg.stages.map(x=>x/100),payoutDays=cfg.payoutDays,fee=cfg.fee,actFee=cfg.actFee,p={tr:cfg.ddMode==='trailing'},m0=r[0],m1=r[1],theoMonthlyProfit=m0.theoMonthlyProfit,theoCycleProfit=m0.theoCycleProfit,row=(l,fn)=>'<tr class="border-t border-slate-200"><td class="p-1.5 text-slate-700">'+l+'</td><td class="p-1.5 font-bold text-right">'+fn(r[0],m0)+'</td><td class="p-1.5 font-bold text-right">'+fn(r[1],m1)+'</td></tr>',pc=x=>riskFmt(x*100,1)+'%',$$=x=>'$'+riskFmt(x,0);
 $('pf-out').innerHTML=`
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 text-xs">
      <div class="p-2 bg-blue-50 border border-blue-200 rounded">
        <span class="text-[10px] text-blue-700 block">Cấu trúc Thử thách (${stages.length} Giai đoạn)</span>
        <b>${stages.map((st,i)=>`P${i+1}: +${riskFmt(st*100,1)}%`).join(' → ')}</b>
      </div>
      <div class="p-2 bg-emerald-50 border border-emerald-200 rounded">
        <span class="text-[10px] text-emerald-800 block">Lợi nhuận Tháng Lý thuyết (${s.propConfig.tradingDays} ngày)</span>
        <b class="text-emerald-700">$${riskFmt(theoMonthlyProfit, 0)} / tháng</b>
        <span class="text-[10px] text-slate-500 block">Chu kỳ ${payoutDays} ngày: $${riskFmt(theoCycleProfit, 0)}</span>
      </div>
      <div class="p-2 bg-amber-50 border border-amber-200 rounded">
        <span class="text-[10px] text-amber-800 block">Phí Thi + Phí Kích Hoạt (Bootcamp/Futures)</span>
        <b>$${riskFmt(fee,0)} + $${riskFmt(actFee,0)} = $${riskFmt(fee+actFee,0)}</b>
      </div>
      <div class="p-2 bg-slate-100 border border-slate-300 rounded">
        <span class="text-[10px] text-slate-600 block">ROI Chuẩn PDF (Cơ chế gốc ${p.tr ? 'Trailing' : 'Static'})</span>
        <b class="${(p.tr ? m1.roiPdfFunded : m0.roiPdfFunded) >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${riskFmt(p.tr ? m1.roiPdfFunded : m0.roiPdfFunded, 1)}% (EV: ${riskFmt(p.tr ? m1.evPct : m0.evPct, 1)}%)</b>
      </div>
    </div>
    <table class="w-full text-xs border border-slate-200">
      <tr class="bg-slate-100"><th class="p-1.5 text-left">Chỉ số Mô phỏng (${stages.length} giai đoạn · Chu kỳ payout ${payoutDays} ngày)</th><th class="p-1.5 text-right">Static DD${p.tr ? '' : ' ★'}</th><th class="p-1.5 text-right">Trailing DD${p.tr ? ' ★' : ''}</th></tr>
      ${row('Tỷ lệ qua từng Giai đoạn (lần 1)', x => x.stPass.map((sp, i) => `P${i+1}: ${pc(sp)}`).join(' · '))}
      ${row('Xác suất vượt TOÀN BỘ thử thách (lần 1)', x => pc(x.pass))}
      ${row('Cháy tài khoản ở Phase 1 / Hết hạn', x => `${pc(x.failPhase1)} / ${pc(x.toPhase1)}`)}
      ${row('Trung vị tổng số lệnh để vượt các vòng', x => x.medT || '–')}
      ${row('Chi phí kỳ vọng 1 lượt (Phí thi + P_pass × Phí kích hoạt)', (_, m) => $$(m.expectedCostOneAttempt))}
      ${row('Tổng phí kỳ vọng cả chiến dịch (tối đa 10 lần thi lại)', x => $$(x.ev))}
      ${row(`Payout kỳ vọng giai đoạn Funded (chu kỳ ${payoutDays} ngày)`, x => $$(x.evPay))}
      ${row('EV theo USD &amp; EV theo % vốn phí bỏ ra (1 lượt)', (_, m) => `${m.evUsd >= 0 ? '+' : ''}${$$(m.evUsd)} (${m.evPct >= 0 ? '+' : ''}${riskFmt(m.evPct, 1)}%)`)}
      ${row('Công thức ROI theo PDF: (P_pass×Payout − Phí_kỳ_vọng)/Phí_kỳ_vọng', (_, m) => `<span class="text-blue-700">${riskFmt(m.roiPdfFunded, 1)}%</span> (1 chu kỳ ${payoutDays}d: ${riskFmt(m.roiPdfCycle, 1)}%)`)}
      ${row('Median ROI (chiến dịch có thi lại)', x => riskFmt(x.roiMed==null?NaN:x.roiMed * 100, 0) + '%')}
      ${row('Số chu kỳ hoàn vốn phí thi', x => x.cyc ? riskFmt(x.cyc, 2) : '∞')}
    </table>
  `;
 const selected=r[cfg.ddMode==='trailing'?1:0];riskChart('adv-p-chart','bar',['Đạt target','Dính Max/Daily loss','Hết horizon'],[{data:[selected.pass,selected.fail,selected.to].map(x=>Math.round(x*cfg.runs)),backgroundColor:['#10b981','#f43f5e','#94a3b8']}],{scales:{y:{beginAtZero:true,ticks:{precision:0}}}});
}
function renderSizer(){const s=RiskStore.read(),r=s.sizer;$('adv-size-out').innerHTML=!r.valid?'<b class="text-rose-700">Thiếu giá hợp lệ, vốn hoặc thông số sản phẩm.</b>':'<div class="grid grid-cols-2 gap-2">'+proStat('Khối lượng tối đa',riskFmt(r.quantity,4),'Bước '+riskFmt(s.sizerConfig.step,4))+proStat('Rủi ro lý thuyết',riskMoney(r.actual),'Hạn mức '+riskMoney(r.amount))+'</div><p class="text-xs mt-2">Tier multiplier: '+riskFmt(r.mult,2)+'×; Điểm dừng: '+riskFmt(r.distance,5)+' đơn vị giá. Trượt giá/gap/phí chưa được cộng vào mức lỗ thực tế.</p>';
 const q=s.quality;$('adv-quality').innerHTML='<b>Kiểm toán dữ liệu:</b> '+q.n+' lệnh đang lọc · '+q.valid+' lệnh đủ 1R chuẩn · '+q.estimated+' lệnh dùng 1R ước lượng · '+q.missing+' lệnh thiếu 1R · '+q.price+' lệnh đủ Entry/SL/Exit · '+q.times+' lệnh đủ timestamp. Chỉ lệnh đủ 1R mới vào số liệu Risk Pro nâng cao.';$('adv-price-quality').innerHTML='<div class="grid grid-cols-2 gap-2">'+proStat('Giá đủ 3 mốc',q.price+'/'+q.n)+proStat('Thời điểm hợp lệ',q.times+'/'+q.n)+'</div>';$('adv-duration').innerHTML='<p class="mt-2 text-xs">Giữ lệnh trung bình (mẫu có timestamp): <b>'+(q.durations.length?riskFmt(q.meanDuration,1)+' phút':'Chưa có')+'</b></p>';riskChart('adv-hold-chart','bar',q.durations.slice(-35).map((_,i)=>'Lệnh '+(i+1)),[{data:q.durations.slice(-35),backgroundColor:'#2563eb'}],{scales:{y:{title:{display:true,text:'Phút giữ lệnh'},beginAtZero:true}}});renderLhTable();}
function renderLhTable(){const s=RiskStore.read(),lh=s.liquidity,overrides=state.riskProfile.assumptions.lhByClass||{};$('lh-table').innerHTML='<div class="font-bold text-slate-700">Phân nhóm giả định cũ (không là bảng Basel) · hiệu dụng = '+riskFmt(lh.effective,1)+' ngày'+(s.simConfig.liquidity==='auto'?'':' <span class="text-amber-700">(đang bị ô chọn chung ghi đè)</span>')+'</div><div class="grid grid-cols-2 md:grid-cols-3 gap-1.5">'+Object.entries(lh.classes).map(([c,group])=>'<label class="flex items-center justify-between gap-1 bg-white border border-slate-200 rounded px-1.5 py-1"><span>'+group.name+' <span class="text-slate-400">('+(lh.counts[c]||0)+' lệnh)</span></span><select data-lhc="'+c+'" class="p-0.5 border border-slate-300 rounded font-bold">'+[10,20,40,60,120].map(v=>'<option value="'+v+'"'+((overrides[c]??group.lh)===v?' selected':'')+'>'+v+'d</option>').join('')+'</select></label>').join('')+'</div><div class="text-slate-500">Kỳ hạn hiệu dụng = trung bình có trọng số theo rủi ro kế hoạch của từng lệnh; ES stress nhân √(kỳ hạn/10). '+lh.missing+' lệnh chưa có 1R xác minh không được gán rủi ro giả. Điều chỉnh đang dùng: '+E(lh.basel.label)+' · √(LH/10) = '+riskFmt(lh.basel.factor,4)+'.</div>';}
function renderZones(){const s=RiskStore.read(),stat=(l,v,n='')=>proStat(l,v,n),mark=x=>x?'✓':'✕';$('zones-capital').innerHTML=stat('Equity',riskMoney(s.equity))+stat('Drawdown thực tế',riskPct(s.dd))+stat('Tier','Tier '+s.tier)+stat('Max Risk / Trade',riskMoney(s.budget));$('zones-edge').innerHTML=stat('Expectancy',riskFmt(s.edge.expectancy)+' R')+stat('Ω(0)',riskFmt(s.edge.omega0))+stat('ES 97,5% lệnh đơn',tailDisplay(s)+' R')+stat('3 cổng',s.gates.pass?'ĐỦ ĐIỀU KIỆN':'CỔNG ĐÓNG','Safety '+mark(s.gates.safety)+' · Edge '+mark(s.gates.edge)+' · N≥30 '+mark(s.gates.sample));$('zones-simulation').innerHTML=s.mc?stat('P50 P&L',riskPct(s.mc.med))+stat('P95 P&L',riskPct(s.mc.p95))+stat('Median Max DD',riskPct(s.mc.ddMed))+stat('P95 Max DD',riskPct(s.mc.ddP95),s.simConfig.horizon+' lệnh · seed '+s.simConfig.seed):stat('Monte Carlo','Chưa chạy');const p=s.prop?.[s.propConfig.ddMode==='trailing'?1:0];$('zones-optimization').innerHTML=stat('f* đề xuất',riskPct(s.recommendation))+stat('RCK robust lý thuyết',riskPct(s.rck.f))+(p?stat('Qua Prop (lần 1)',riskPct(p.pass))+stat('EV một lượt',riskMoney(p.evUsd),'ROI '+riskFmt(p.roiPdfFunded,1)+'%'):stat('Prop Firm','Chưa chạy'));}
function renderP5Results(){const key=document.body.dataset.page;if(key==='simulation'){renderSimulationResults();renderStressResults();renderTailSummary();}if(key==='riskprop')renderPropResults();if(key==='zones')renderZones();if(key==='riskopt'){renderRiskOpt();renderRiskCompare();}if(key==='riskcapital')renderFeedback();if(key==='mapping')renderSchemaExplorer();}
function renderP5Page(key){syncP5Controls();if(key==='simulation'){renderSimulationResults();renderStressResults();renderTailSummary();ensureSimulationJobs();ensureStressJob();}if(key==='riskprop'){renderPropResults();ensurePropJob();}if(key==='risktools')renderSizer();if(key==='zones')renderZones();}
function bindP5Events(){for(const symbol of Object.keys(PRODUCT_SPECS)){if(![...$('adv-symbol').options].some(o=>o.value===symbol))$('adv-symbol').add(new Option(symbol,symbol));}for(const [key,p] of Object.entries(PROP_PRESETS)){if(![...$('adv-preset').options].some(o=>o.value===key))$('adv-preset').add(new Option(p.n,key));if(![...$('tc-prop').options].some(o=>o.value===key))$('tc-prop').add(new Option(p.n,key));}if(![...$('adv-p-runs').options].some(o=>o.value==='10000'))$('adv-p-runs').add(new Option('10000','10000'));
 $('adv-preset').onchange=propPreset;$('adv-p-run').onclick=propSimulation;for(const id of Object.keys(PROP_FIELDS))if(!['adv-preset','adv-p-run'].includes(id)&&!$(id).hasAttribute('onchange'))$(id).addEventListener('change',propSimulation);
 for(const id of Object.keys(SIZER_FIELDS))$(id).addEventListener('change',id==='adv-symbol'?syncSizerSymbol:calcSizer);
 for(const id of Object.keys(STRESS_FIELDS))if(!$(id).hasAttribute('oninput'))$(id).addEventListener('input',stress);
 $('adv-stress-reset').onclick=()=>{saveP5Config('stress',{...STRESS_DEFAULTS});};$('lh-table').addEventListener('change',e=>{const c=e.target.dataset.lhc,value=Number(e.target.value);if(c&&[10,20,40,60,120].includes(value))writeData(d=>{d.riskProfile.assumptions.lhByClass={...d.riskProfile.assumptions.lhByClass,[c]:value};});});syncP5Controls();
}

function buildDatabaseTables(){return StorageData.tables();}
function adaptUnifiedTrades(list){return StorageData.adapt(list);}
function exportDatabaseJson(){downloadJson('tuannhatky_risk_schema_dump.json',JSON.stringify(buildDatabaseTables(),null,2));}
function exportSupabaseSql(){downloadJson('tuannhatky_risk_supabase.sql',StorageData.sql());}
function saveToIndexedDB(){return StorageVault.enqueue();}
async function captureSimulationSnapshot(){try{const s=RiskStore.read();if(!s.mc){const job=await RiskStore.job('mc',s.inputs.mc);if(job.stale)throw new Error('Dữ liệu đã thay đổi, hãy thử lại');}const sn=StorageData.snapshot();if(writeData(d=>d.snapshots.push(sn)))toast('Đã lưu snapshot đủ 12 trường với kết quả Monte Carlo thật');}catch(error){toast('Không lưu được snapshot: '+error.message);}}
function resetDefaultStorage(){return LifecycleUI.reset();}
async function restoreUnifiedText(text){const data=Core.decodeBackup(text);data.extra={...cloneValue(extraDefaults),...data.extra};data.ext2={...cloneValue(extDefaults),...data.ext2};await LifecycleUI.backup();await StorageVault.archive(Core.snapshot());Core.importBackup(JSON.stringify(data));if(bootProblem){location.reload();return;}await StorageVault.queue;initTheme();toast('Đã khôi phục '+state.trades.length+' lệnh; bản trước được sao lưu');return Core.snapshot();}
async function restoreIndexedDB(){try{await StorageVault.queue;const data=await StorageVault.read();if(!data){toast('Chưa có bản phản chiếu IndexedDB');return;}await restoreUnifiedText(JSON.stringify(data));}catch(error){toast('Không khôi phục được IndexedDB: '+error.message);}}
function renderStorageStatus(){const el=$('storage-mirror-status');if(!el)return;el.textContent=StorageVault.status+(StorageVault.lastError?' · '+StorageVault.lastError:'')+'. Dữ liệu nằm trên trình duyệt này. Xóa dữ liệu trang có thể xóa cả hai kho; hãy tải JSON định kỳ. Xuất SQL chưa phải đồng bộ cloud.';el.className='p-3 border rounded text-xs '+(StorageVault.lastError?'bg-rose-50 border-rose-300 text-rose-800':'bg-slate-50 border-slate-200 text-slate-600');}
function importUnifiedTrades(list,replace=false){const r=adaptUnifiedTrades(list);if(!r.trades.length)return {imported:0,duplicates:0,skipped:r.skipped};const data=Core.snapshot(),seen=new Set((replace?[]:data.trades).map(t=>[t.date,t.symbol,t.side,t.netPnl].join('|'))),ids=new Set((replace?[]:data.trades).map(t=>String(t.id))),incoming=[],renamed=[];let duplicates=0;
 for(const t of r.trades){const key=[t.date,t.symbol,t.side,t.netPnl].join('|');if(seen.has(key)){duplicates++;continue;}seen.add(key);const previous=t.id;let n=1;while(ids.has(String(t.id)))t.id=String(previous)+'-import-'+n++;if(t.id!==previous)renamed.push({from:previous,to:t.id});ids.add(String(t.id));incoming.push(t);}
 if(!incoming.length&&!replace)return {imported:0,duplicates,skipped:r.skipped,renamed};downloadJson('tuannhatky-before-unified-import.json',Core.backupText());Core.commit(d=>{d.trades=replace?incoming:d.trades.concat(incoming);for(const t of incoming)for(const key of ['market','setup','discipline','tag'])if(t[key]&&!cbPool(key).some(o=>o.v===t[key])&&!d.customOptions[key].includes(t[key]))d.customOptions[key].push(t[key]);d.sampleSource=null;});return {imported:incoming.length,duplicates,skipped:r.skipped,renamed};
}
function runUnifiedImport(replace){const msg=$('unified-import-msg');try{const raw=JSON.parse($('unified-import-text').value),list=Array.isArray(raw)?raw:raw.trades??raw.data;if(!Array.isArray(list))throw new Error('JSON cần có mảng trades/data');const r=importUnifiedTrades(list,replace);msg.className='text-[11px] font-bold '+(r.imported?'text-emerald-700':'text-rose-700');msg.textContent='Đã nhập '+r.imported+' lệnh · trùng '+r.duplicates+' · bỏ qua '+r.skipped.length+(r.renamed?.length?' · đổi '+r.renamed.length+' ID va chạm':'')+(r.skipped.length?'. '+r.skipped.map(x=>'Dòng '+(x.index+1)+': '+x.reason).join('; '):'');}catch(error){msg.className='text-[11px] font-bold text-rose-700';msg.textContent='Không nhập: '+error.message;}}
function renderSchemaExplorer(){const el=$('db-schema-tables-view');if(!el)return;const escapeData=value=>typeof value==='string'?E(value):Array.isArray(value)?value.map(escapeData):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,escapeData(v)])):value,db=escapeData(buildDatabaseTables()),rp=db.risk_profiles[0];el.innerHTML=`
    <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
      <div class="font-bold text-slate-900 flex justify-between"><span>1. Bảng <code>risk_profiles</code></span><span class="text-emerald-700">1 bản ghi active</span></div>
      <div class="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 max-h-40 overflow-y-auto">
        profile_id: ${rp.profile_id}<br>
        account_type: ${rp.account_type??'Chưa xếp loại — chọn FTMO / The5ers / Topstep trong Risk Profile'} (${rp.prop_firm_preset})<br>
        current_equity: $${riskFmt(rp.current_equity)}<br>
        current_dd_pct: ${rp.current_drawdown_pct}% (Tier ${rp.active_tier})<br>
        tier_thresholds: [${rp.tier2_threshold_pct}%, ${rp.tier3_threshold_pct}%]<br>
        daily_loss_k: ${rp.daily_loss_k_streaks} | f_tier1: ${rp.f_tier1_pct}%<br>
        rck_mode: ${rp.rck_mode} | rec_risk: ${rp.recommended_risk_pct}%<br>
        initial_balance: $${riskFmt(rp.initial_balance)} | peak_equity: $${riskFmt(rp.peak_equity)}<br>
        max_dd_limit: ${rp.max_dd_limit_pct}% | ruin_threshold: ${rp.ruin_threshold_pct}% | omega_L: ${rp.omega_threshold_L}R
      </div>
    </div>
    <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
      <div class="font-bold text-slate-900 flex justify-between"><span>2. Bảng <code>trades_journal</code></span><span class="text-blue-700">${db.trades_journal.length} bản ghi</span></div>
      <div class="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 max-h-40 overflow-y-auto">
        ${db.trades_journal.slice(-4).reverse().map(t => `${t.trade_id} | ${t.symbol} ${t.side} | Plan 1:${t.planned_rr_ratio} | R=${t.realized_r_multiple} ($${t.realized_pnl_usd}) | ${t.strategy_id} | ${t.asset_class}/${t.liquidity_horizon_days}d | ${t.session_tag} | [${t.rule_adherence_tags.join(', ')}]`).join('<br>')}
      </div>
    </div>
    <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
      <div class="font-bold text-slate-900 flex justify-between"><span>3. Bảng <code>simulation_snapshots</code></span><span class="text-amber-700">${db.simulation_snapshots.length} snapshots</span></div>
      <div class="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 max-h-40 overflow-y-auto">
        ${db.simulation_snapshots.length ? db.simulation_snapshots.slice(0, 4).map(s => `${s.snapshot_id} (${s.created_at}): N=${s.sample_size_n}, Exp=${s.expectancy_r}R, Rec=${riskFmt(s.rck_optimal_fraction*100)}%, Tier=${s.tier_state}, W=${s.win_rate_w ?? '–'}, b=${s.payoff_ratio_b ?? '–'}, ES=${s.es_975_r ?? '–'}R, VaR=${s.var_975_r ?? '–'}/${s.var_990_r ?? '–'}R, P95MDD=${s.mc_p95_mdd===null?'–':riskFmt(s.mc_p95_mdd*100)}%, RoR=${s.mc_ror_prob ?? '–'}`).join('<br>') : 'Chưa có snapshot. Bấm "+ Chụp Snapshot Mô Phỏng" để lưu.'}
      </div>
    </div>
  `;renderStorageStatus();}

let activeDialog=null,dialogReturnFocus=null;
function syncAccessibility(){
 const labels={'rng-stress-streak-len':'Số lệnh lỗ liên tiếp khi stress','rng-stress-wr-drop':'Mức giảm tỷ lệ thắng khi stress','rng-stress-rr-drop':'Mức giảm Payoff khi stress','breakdown-dim':'Chiều phân nhóm thống kê','filter-date-from':'Từ ngày','filter-date-to':'Đến ngày','filter-date-range':'Khoảng ngày','filter-operator':'Kết hợp bộ lọc AND hoặc OR','filter-result':'Kết quả giao dịch','saved-views-dropdown':'Chế độ xem đã lưu','sim-horizon':'Số lệnh tương lai','sim-runs':'Số đường mô phỏng','sim-risk':'Rủi ro mỗi lệnh phần trăm','sim-dd':'Ngưỡng Drawdown phần trăm','sim-slip':'Trượt giá thêm theo R','sim-cap':'Chốt lãi tối đa theo R','sel-mc-mode':'Phương pháp Monte Carlo','sel-mc-seed':'Seed tái lập mô phỏng','sel-slip':'Hệ số trượt giá đuôi','sel-win':'Số lệnh gộp để phân tích đuôi','pf-actfee':'Phí kích hoạt tài khoản quỹ','pf-pdays':'Chu kỳ trả thưởng theo ngày','pf-comp':'Lãi kép hoặc tuyến tính','input-dd-pct':'Drawdown cần phục hồi phần trăm','ror-winrate':'Tỷ lệ thắng cho RoR','ror-payoff':'Payoff cho RoR','ror-floor':'Ngưỡng phá sản cho RoR','ror-risk':'Rủi ro mỗi lệnh cho RoR','om-l-slider':'Ngưỡng L cho Omega','om-setup-1':'Playbook thứ nhất','om-setup-2':'Playbook thứ hai','whatif-scenario-select':'Kịch bản thoát lệnh giả định','dl-date-pick':'Ngày xét hạn mức lỗ','as-tier-cap':'Giả định công thức trần Tier','as-tail-mode':'Giả định nhóm đuôi 2,5 phần trăm','as-safe-tier':'Tier an toàn tối đa','as-rec-rule':'Quy tắc mức rủi ro khuyên dùng','as-lock-stress':'Khóa Stress Lab theo các cổng','unified-import-text':'JSON lệnh cần nhập'};
 document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(el=>{if(labels[el.id]&&!el.hasAttribute('aria-label'))el.setAttribute('aria-label',labels[el.id]);if(el.labels?.length||el.hasAttribute('aria-label')||el.hasAttribute('aria-labelledby'))return;const previous=el.previousElementSibling,near=previous?.tagName==='LABEL'?previous:el.parentElement?.querySelector('label');if(near&&!near.control&&!near.querySelector('input,select,textarea')&&el.id)near.htmlFor=el.id;else{const name=labels[el.id]||el.title||el.placeholder||near?.textContent.trim();if(name)el.setAttribute('aria-label',name);}});
 document.querySelectorAll('.overflow-x-auto,.overflow-y-auto').forEach(el=>{if(el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight){el.tabIndex=0;if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label','Vùng nội dung có thể cuộn');}});
 const names={'risk-detail-modal':'Thêm hoặc sửa giao dịch','cashflow-modal':'Nạp hoặc rút vốn','settings-drawer':'Cài đặt','tooltip-modal':'Trợ giúp'},dialogs=Object.keys(names).map(id=>$(id)).filter(Boolean);
 for(const el of dialogs){el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',names[el.id]);}
 const visible=dialogs.filter(el=>!el.classList.contains('hidden')&&el.getClientRects().length),next=visible.at(-1)||null;
 if(next!==activeDialog){const previous=activeDialog;activeDialog=next;if(next){if(!previous)dialogReturnFocus=document.activeElement;const focusable=next.querySelector('button:not(:disabled),input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]');focusable?.focus();}else if(dialogReturnFocus?.isConnected){dialogReturnFocus.focus();dialogReturnFocus=null;}}
 const menu=document.querySelector('button[onclick="toggleMobileSidebar()"]');if(menu){menu.setAttribute('aria-controls','sidebar');menu.setAttribute('aria-expanded',String(!$('sidebar').classList.contains('hidden')));if(!menu.hasAttribute('aria-label'))menu.setAttribute('aria-label','Mở menu');}
 document.querySelectorAll('canvas').forEach(el=>{el.setAttribute('role','img');if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label','Biểu đồ '+(el.closest('.bg-white')?.querySelector('h2,h3')?.textContent.trim()||el.id));});
}
function bindAccessibility(){
 document.addEventListener('keydown',e=>{const box=activeDialog;if(!box)return;if(e.key==='Escape'){if(box.id==='risk-detail-modal')editorClose();else if(box.id==='cashflow-modal')toggleCashflowModal();else if(box.id==='settings-drawer')toggleSettingsDrawer();return;}
  if(e.key!=='Tab')return;const list=[...box.querySelectorAll('a[href],button:not(:disabled),input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);if(!list.length){e.preventDefault();return;}const first=list[0],last=list.at(-1);if(e.shiftKey&&(document.activeElement===first||!box.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!box.contains(document.activeElement))){e.preventDefault();first.focus();}});
 const observer=new MutationObserver(syncAccessibility);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});syncAccessibility();
}
async function retireLegacyCache(){if(!('serviceWorker' in navigator))return;const scope=new URL('/v6/',location.origin).href;for(const registration of await navigator.serviceWorker.getRegistrations())if(registration.scope===scope){await registration.unregister();}if('caches' in globalThis)for(const name of await caches.keys())if(name.startsWith('workbox-')&&name.includes(scope))await caches.delete(name);}

boot();

