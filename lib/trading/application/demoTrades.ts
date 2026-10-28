import { mulberry32 } from '../selectors/inference';
import { stageManualTrades, type ManualInput } from './manualTrade';
import type { LedgerSnapshot } from '../domain/types';
export const DEMO_ACCOUNT_LABEL='MINH HỌA · 30 lệnh giả lập';
export async function stageDemoTrades(current:{version:number;data:LedgerSnapshot},now=new Date()) {
  if(current.data.batches.some(b=>b.connector==='demo-30'&&b.status==='committed'))throw new Error('Bộ 30 lệnh minh họa đã có. Mở tài khoản Minh họa hoặc hoàn tác đợt đó trước khi tạo lại.');
  const random=mulberry32(301019),symbols=['FPT','HPG','VCB','SSI','MWG','VNM'],setups=['Pullback xu hướng','Breakout + Retest','Hỗ trợ / Kháng cự'],dates:Date[]=[];
  const day=new Date(now);day.setUTCHours(0,0,0,0);day.setUTCDate(day.getUTCDate()-1);
  while(dates.length<30){if(day.getUTCDay()!==0&&day.getUTCDay()!==6)dates.unshift(new Date(day));day.setUTCDate(day.getUTCDate()-1);}
  const inputs:ManualInput[]=dates.map((date,i)=>{
    const entry=(200+Math.floor(random()*800))*100,qty=(1+Math.floor(random()*5))*100,move=(1+Math.floor(random()*25))*100,exit=entry+(i%5===0||i%5===3?-move:move),fees=Math.round((entry+exit)*qty*.001),open=new Date(date),close=new Date(date);
    open.setUTCHours(2,5+Math.floor(random()*40),0,0);close.setUTCHours(6,Math.floor(random()*40),0,0);
    return {accountLabel:DEMO_ACCOUNT_LABEL,market:'stock',currency:'VND',symbol:symbols[i%symbols.length],direction:'LONG',openTime:open.toISOString(),closeTime:close.toISOString(),quantity:String(qty),entryPrice:String(entry),exitPrice:String(exit),multiplier:'1',fees:String(fees),carryingCost:'0',rateToVND:'1',riskVND:String(qty*1000),setup:setups[i%3],notes:`DỮ LIỆU GIẢ LẬP #${i+1}/30 — chỉ để trải nghiệm nhật ký, không phải giao dịch hoặc thành tích thực tế.`,mistakeTags:i%7===0?['FOMO']:i%7===3?['Thoát sớm']:[],reviewed:i%5!==4,disciplineScore:i%7===0?60:90,demo:true};
  });
  return stageManualTrades(inputs,current,{demo:true,identity:'demo-30-v1'});
}
