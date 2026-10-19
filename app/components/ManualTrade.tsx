'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLedger } from './LedgerContext';
import { stageManualTrades, type ManualInput } from '../../lib/trading/application/manualTrade';
import { stageDemoTrades } from '../../lib/trading/application/demoTrades';
import { displayAmount } from '../../lib/trading/import/presentation';
import { rMultiple } from '../../lib/trading/selectors';
import type { StagedImport } from '../../lib/trading/import/stage';

const localTime=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
export default function ManualTrade({close,onSaved}:{close:()=>void;onSaved:(accountId:string)=>void}) {
  const {store,snapshot}=useLedger(),dialog=useRef<HTMLDialogElement>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[stage,setStage]=useState<StagedImport>(),[currency,setCurrency]=useState('VND'),[reviewed,setReviewed]=useState(false);
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function preview(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');const f=new FormData(event.currentTarget),get=(key:string)=>String(f.get(key)??'').trim();
    try{
      const input:ManualInput={accountLabel:get('account'),market:get('market') as ManualInput['market'],currency:currency as ManualInput['currency'],symbol:get('symbol'),direction:get('direction') as ManualInput['direction'],openTime:get('open'),closeTime:get('close'),quantity:get('qty'),entryPrice:get('entry'),exitPrice:get('exit'),multiplier:get('multiplier'),fees:get('fee'),carryingCost:get('carrying'),rateToVND:currency==='VND'?'1':get('rate'),riskVND:get('risk')||undefined,initialStop:get('stop')||undefined,setup:get('setup'),notes:get('notes'),mistakeTags:get('tags').split(',').map(t=>t.trim()).filter(Boolean),reviewed,disciplineScore:reviewed?Number(get('score')):undefined};
      setStage(await stageManualTrades([input],await store!.snapshot()));
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function demo(){setBusy(true);setError('');try{setStage(await stageDemoTrades(await store!.snapshot()));}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function save(){if(!stage)return;setBusy(true);setError('');try{
    await store!.commitBatch({batch:stage.batch,fills:stage.parsed.fills,cashEvents:stage.parsed.cashEvents,accounts:[stage.account],overlays:stage.overlays},stage.batch.ledgerVersionAtStage);
    onSaved(stage.account.accountId);
  }catch(e){setError(String(e));}finally{setBusy(false);}}
  const cycles=stage?.replay.cycles.filter(c=>c.sourceBatchIds.includes(stage.batch.batchId)&&!c.shadowed)??[];
  return <dialog className="hub-dialog" ref={dialog} aria-label="Thêm giao dịch" onCancel={e=>{if(busy)e.preventDefault();else close();}}>
    <header><div><h2>Thêm giao dịch</h2><p>Lưu vào cùng sổ Nhật ký, Lịch và thống kê. Sau khi lưu, chuyển ngay đến Nhật ký.</p></div><button type="button" disabled={busy} onClick={close}>Đóng</button></header>
    <details><summary>Trải nghiệm với dữ liệu minh họa</summary><p>30 lệnh giả lập, có lãi/lỗ, phí, setup, 1R và review. Tạo trong tài khoản riêng; không phải giao dịch thực tế. Hoàn tác cả đợt tại Kết nối dữ liệu → Lịch sử nhập.</p><button type="button" onClick={demo} disabled={busy||!store}>Xem trước 30 lệnh minh họa</button></details>
    <form onSubmit={preview} onChange={()=>setStage(undefined)}>
      <fieldset disabled={busy}><legend>1. Tài khoản & giao dịch</legend><div className="hub-fields">
        <label>Tài khoản<input name="account" defaultValue="Nhập tay" list="manual-account-labels" required/><datalist id="manual-account-labels">{snapshot?.data.accounts.filter(a=>a.platform==='MANUAL'&&!a.label.startsWith('MINH HỌA')).map(a=><option key={a.accountId} value={a.label}/>)}</datalist></label>
        <label>Thị trường<select name="market"><option value="stock">Chứng khoán</option><option value="crypto">Crypto</option><option value="forex">Forex</option><option value="commodity">Hàng hóa</option></select></label>
        <label>Mã sản phẩm<input name="symbol" placeholder="FPT, BTCUSDT, XAUUSD…" required/></label>
        <label>Chiều lệnh<select name="direction"><option>LONG</option><option>SHORT</option></select></label>
        <label>Mở lệnh (giờ thiết bị)<input name="open" type="datetime-local" defaultValue={localTime(new Date(Date.now()-3600000))} required/></label>
        <label>Đóng lệnh (giờ thiết bị)<input name="close" type="datetime-local" defaultValue={localTime(new Date())} required/></label>
        <label>Khối lượng (cổ phiếu / coin / lot)<input name="qty" type="number" min="0.00000001" step="any" required/></label>
        <label>Quy mô hợp đồng / 1 đơn vị khối lượng<input name="multiplier" type="number" min="0.00000001" step="any" defaultValue="1" required/></label>
        <label>Giá vào<input name="entry" type="number" min="0.00000001" step="any" required/></label>
        <label>Giá đóng<input name="exit" type="number" min="0.00000001" step="any" required/></label>
      </div><p>Chứng khoán nhập giá theo đồng; Crypto theo tiền định giá. Forex/hàng hóa: điền đúng quy mô hợp đồng của broker; hệ thống không tự đoán giá trị một lot.</p></fieldset>
      <fieldset disabled={busy}><legend>2. Chi phí & rủi ro</legend><div className="hub-fields">
        <label>Tiền định giá<select name="ccy" value={currency} onChange={e=>setCurrency(e.target.value)}><option>VND</option><option>USD</option><option>USDT</option></select></label>
        <label>Tỷ giá sang VNĐ<input key={currency} name="rate" type="number" min="0.00000001" step="any" defaultValue={currency==='VND'?'1':String(snapshot?.data.settings.defaultFX??25500)} disabled={currency==='VND'} required={currency!=='VND'}/></label>
        <label>Tổng phí & thuế (tiền định giá)<input name="fee" type="number" min="0" step="any" placeholder="Nhập 0 nếu đã xác nhận không có phí" required/></label>
        <label>Funding/Swap (dương = trả, âm = nhận)<input name="carrying" type="number" step="any" defaultValue="0" required/></label>
        <label>1R đã xác nhận (VNĐ; có thể để trống)<input name="risk" type="number" min="0.00000001" step="any"/></label>
        <label>SL ban đầu đã xác nhận (không phải SL đã dời)<input name="stop" type="number" min="0.00000001" step="any"/></label>
      </div><p>Net = chênh lệch giá × khối lượng × quy mô hợp đồng − phí − funding trả. 1R nhập trực tiếp được ưu tiên; nếu bỏ trống, chỉ dùng SL ban đầu hợp lệ.</p></fieldset>
      <fieldset disabled={busy}><legend>3. Nhật ký & review</legend><div className="hub-fields">
        <label>Setup<input name="setup" placeholder="Pullback, Breakout…"/></label><label>Lỗi đã ghi nhận (phân cách dấu phẩy)<input name="tags" placeholder="FOMO, Dời SL…"/></label>
        <label>Điểm kỷ luật (0–100)<input name="score" type="number" min="0" max="100" defaultValue="80" disabled={!reviewed} required={reviewed}/></label>
      </div><label>Ghi chú / lý do vào và đóng lệnh<textarea name="notes"/></label><label className="hub-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> Tôi đã review lệnh này</label></fieldset>
      <button className="gold-button" disabled={busy||!store} type="submit">Xem trước trước khi lưu</button>
    </form>
    {stage&&<section className="hub-notice" aria-label="Xem trước giao dịch"><h3>{stage.batch.connector==='demo-30'?'30 lệnh MINH HỌA — chưa lưu':'Đối chiếu giao dịch — chưa lưu'}</h3><p>Tài khoản: {stage.account.label} · {cycles.length} chu kỳ đóng.</p><div className="hub-table"><table><thead><tr><th>Mã</th><th>Gross</th><th>Net</th><th>1R / R</th><th>Setup / Review</th></tr></thead><tbody>{cycles.map(c=><tr key={c.tradeId}><td>{c.symbol}</td><td>{displayAmount(c.grossVND)}</td><td>{displayAmount(c.netVND)}</td><td>{displayAmount(c.risk.amountVND)} / {rMultiple(c)===undefined?'—':Number(rMultiple(c)).toFixed(2)+'R'}</td><td>{c.overlay?.setupTag??'Chưa gán'} / {c.overlay?.reviewStatus==='reviewed'?'Đã review':'Chờ review'}</td></tr>)}</tbody></table></div>{stage.warnings.map((w,i)=><p key={i}>{w.message}</p>)}<button className="gold-button" type="button" disabled={busy||stage.warnings.some(w=>w.severity!=='info')} onClick={save}>{stage.batch.connector==='demo-30'?'Lưu 30 lệnh minh họa vào Nhật ký':'Lưu giao dịch vào Nhật ký'}</button></section>}
    {error&&<p role="alert" className="hub-error">{error}</p>}
  </dialog>;
}
