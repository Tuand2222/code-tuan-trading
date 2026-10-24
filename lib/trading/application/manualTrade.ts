import { D, dec, positive } from '../domain/decimal';
import { bookKey, fillKey, hash } from '../domain/identity';
import { accountSchema, type Account, type MarketType, type TradeFill, type TradeOverlay, type LedgerSnapshot } from '../domain/types';
import { createBatch, stageImport } from '../import/stage';

export interface ManualInput {
  accountLabel: string; market: MarketType; currency: 'VND'|'USD'|'USDT';
  symbol: string; direction: 'LONG'|'SHORT'; openTime: string; closeTime: string;
  quantity: string; entryPrice: string; exitPrice: string; multiplier: string;
  fees: string; carryingCost: string; rateToVND: string;
  riskVND?: string; initialStop?: string; setup?: string; notes?: string; mistakeTags?: string[];
  reviewed: boolean; disciplineScore?: number; demo?: boolean;
}
export async function stageManualTrades(inputs: ManualInput[], current: {version:number;data:LedgerSnapshot}, options: {demo?:boolean;identity?:string} = {}) {
  if(!inputs.length)throw new Error('Chưa có giao dịch.');
  const first=inputs[0], label=first.accountLabel.trim(), multiplier=positive(first.multiplier), currency=first.currency;
  if(!label)throw new Error('Nhập tên tài khoản.');
  const accountId=await hash(['manual-v3',label,first.market,currency,multiplier]);
  const account:Account=current.data.accounts.find(a=>a.accountId===accountId)??accountSchema.parse({accountId,accountKey:`${label}:${first.market}:${currency}:${multiplier}`,label,market:first.market,platform:'MANUAL',baseCcy:currency,quoteCcy:currency,costBasis:'fifo',allowsShort:first.market!=='stock',bookMode:'hedging',sourceTimezone:'UTC',pnlModel:'linear',contractMultiplier:multiplier,openingBalances:[]});
  const identity=options.identity??crypto.randomUUID(),rate=currency==='VND'?'1':positive(first.rateToVND);
  const batch=await createBatch('generic-template',{name:options.demo?'MINH HỌA · 30 lệnh giả lập':'Giao dịch nhập tay',headers:[],rows:[]},account,{templateFingerprint:'manual-v3-complete',platform:'MANUAL',reportType:'fills',granularity:'fill',columnMapping:{},decimalSeparator:'.',thousandSeparator:'',sourceTimezone:'UTC',priceUnit:{multiplierToCcy:'1',confirmedBy:'user',crossCheck:'n/a'},pnlBasis:'gross',costCompleteness:'complete',openingPositionsConfirmed:true},current.version,await hash(identity),rate);
  batch.connector=options.demo?'demo-30':'manual';batch.reportType='fills';batch.counts.rows=inputs.length*2;
  const fills:TradeFill[]=[],overlays:TradeOverlay[]=[];
  for(const [i,input] of inputs.entries()){
    if(input.accountLabel.trim()!==label||input.market!==first.market||input.currency!==currency||positive(input.multiplier)!==multiplier||currency!=='VND'&&positive(input.rateToVND)!==rate)throw new Error('Một đợt chỉ dùng một tài khoản, tiền định giá, tỷ giá và quy mô hợp đồng.');
    const symbol=input.symbol.trim().toUpperCase();if(!symbol)throw new Error('Nhập mã sản phẩm.');
    const open=new Date(input.openTime),close=new Date(input.closeTime);if(!Number.isFinite(+open)||!Number.isFinite(+close)||close<open)throw new Error('Thời gian đóng phải từ thời gian mở trở đi.');
    if(input.direction!=='LONG'&&input.direction!=='SHORT')throw new Error('Chiều lệnh không hợp lệ.');
    if(input.market==='stock'&&input.direction==='SHORT')throw new Error('Không bán khống chứng khoán cơ sở.');
    const qty=positive(input.quantity),entry=positive(input.entryPrice),exit=positive(input.exitPrice),fees=dec(D(input.fees)),carrying=dec(D(input.carryingCost));if(D(fees).lt(0))throw new Error('Phí/thuế không được âm.');
    if(input.riskVND)positive(input.riskVND);if(input.initialStop)positive(input.initialStop);
    if(input.reviewed&&(input.disciplineScore===undefined||!Number.isFinite(input.disciplineScore)||input.disciplineScore<0||input.disciplineScore>100))throw new Error('Điểm kỷ luật phải từ 0 đến 100.');
    const id=`${identity}:${i}`,side=input.direction==='LONG'?'buy':'sell',openId=crypto.randomUUID(),closeId=crypto.randomUUID();
    const base={batchId:batch.batchId,accountId,bookKey:bookKey(account,{symbol,positionId:id}),symbol,rootSymbol:symbol,positionId:id,role:'fill' as const,qty,active:true,synthetic:'manual' as const,normVersion:1,dedupeOcc:1,dedupeKey:'',raw:{origin:options.demo?'demo-generated':'user-entered',demo:options.demo?'true':'false'}};
    const opening:TradeFill={...base,fillId:openId,nativeId:`${id}:open`,tsUtc:open.toISOString(),seq:'0',side,price:entry,costs:[]};
    const closing:TradeFill={...base,fillId:closeId,nativeId:`${id}:close`,tsUtc:close.toISOString(),seq:'1',side:side==='buy'?'sell':'buy',price:exit,costs:[{kind:'commission',amount:fees,ccy:currency,origin:'reported'},{kind:'funding',amount:carrying,ccy:currency,origin:'reported'}]};
    opening.dedupeKey=await fillKey(opening,account);closing.dedupeKey=await fillKey(closing,account);fills.push(opening,closing);
    overlays.push({overlayId:crypto.randomUUID(),anchorFillIds:[openId,closeId],state:'attached',setupTag:input.setup?.trim()||undefined,notes:input.notes,mistakeTags:input.mistakeTags??[],reviewStatus:input.reviewed?'reviewed':'needs-review',disciplineScore:input.reviewed?input.disciplineScore:undefined,riskOverrideVND:input.riskVND?positive(input.riskVND):undefined,stopLossPrice:input.initialStop?positive(input.initialStop):undefined,stopOrigin:input.initialStop?'confirmed-initial':undefined,updatedAt:new Date().toISOString()});
  }
  return stageImport({fills,cashEvents:[],errors:[],warnings:[]},batch,account,current.data,overlays);
}
