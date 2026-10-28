import { selectScope, dateInZone, type Filters } from './index';
import { sum } from '../domain/decimal';
import type { ReplayResult } from '../domain/types';
function week(date:string){const d=new Date(`${date}T00:00:00Z`),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=d.getUTCFullYear(),first=new Date(Date.UTC(y,0,1));return `${y}-W${String(Math.ceil(((d.getTime()-first.getTime())/86400000+1)/7)).padStart(2,'0')}`;}
export function weeklyReview(result:ReplayResult,filters:Filters={}) {
  const {cycles,events}=selectScope(result,filters),groups=new Map<string,typeof events>();
  for(const e of events){const key=week(dateInZone(e.tsUtc,filters.timezone));if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(e);}
  return [...groups].sort(([a],[b])=>b.localeCompare(a)).map(([key,es])=>{const cs=cycles.filter(c=>week(dateInZone(c.closeTsUtc!,filters.timezone))===key),reviewed=cs.filter(c=>c.overlay?.reviewStatus==='reviewed').length;
    return {week:key,eventCount:es.length,closed:cs.length,reviewed,netVND:es.every(e=>e.netVND!==undefined)?sum(es.map(e=>e.netVND!)):undefined,
      questions:[`${cs.length-reviewed} lệnh chưa review: bạn đã đối chiếu cả lệnh thắng và lệnh thua chưa?`,`${cs.filter(c=>!c.risk.amountVND).length} lệnh chưa có 1R: rủi ro ban đầu có được ghi lại trước khi vào lệnh không?`,`${cs.filter(c=>c.overlay?.mistakeTags.length).length} lệnh có lỗi đã ghi nhận: tuần sau bạn sẽ thay đổi một bước nào trong quy trình?`]};});
}
