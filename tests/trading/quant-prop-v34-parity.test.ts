import {it,expect} from 'vitest';
import Decimal from 'decimal.js';
import {QuantV34 as Q} from '../../src/core/quant-v34.js';
import cases from './fixtures/quant-prop-v34-oracles.json';
for(const [i,f] of cases.entries())it('v3.4 Python funded path '+i+' '+f.config.ddType+' '+f.config.afterPayout,()=>{
 const r=Q.propPath(f.config,{dailyReturns:f.daily,dayCap:f.daily.length});
 expect(r.status).toBe(f.expected.status);expect(r.survived).toBe(f.expected.survived);expect(r.reason).toBe(f.expected.reason);
 for(const [js,py] of [['balance','balance'],['floor','floor'],['grossPayout','gross_payout'],['netPayout','net_payout']] as const)expect(new Decimal(r[js]).eq(f.expected[py])).toBe(true);
 expect(r.payouts.length).toBe(f.expected.payouts.length);
 for(const [j,item] of r.path.entries()){const e=f.expected.path[j];expect(item.day).toBe(e.day);expect(item.event).toBe(e.event);expect(new Decimal(item.balance).eq(e.balance)).toBe(true);expect(new Decimal(item.floor).eq(e.floor)).toBe(true);}
});
