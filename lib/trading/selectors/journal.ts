import type { Cycle } from '../domain/types';
import { rMultiple } from './index';
export function journalCSV(cycles:Cycle[]) {
  const quote=(value:string)=>`"${(/^[\s]*[=+\-@\t\r]/.test(value)?"'"+value:value).replaceAll('"','""')}"`;
  const rows=[['trade_id','account','symbol','direction','status','close_utc','gross_vnd','net_vnd','risk_vnd','r_multiple','setup','review_status','notes'],...cycles.map(c=>[c.tradeId,c.accountId,c.symbol,c.direction,c.status,c.closeTsUtc??'',c.grossVND??'',c.netVND??'',c.risk.amountVND??'',rMultiple(c)??'',c.overlay?.setupTag??'',c.overlay?.reviewStatus??'needs-review',c.overlay?.notes??''])];
  return '\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n');
}
