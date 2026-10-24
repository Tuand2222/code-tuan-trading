import { expect, it } from 'vitest';
import { readLegacySource } from '../../lib/trading/storage/legacySource';
it('retains an explicitly real legacy journal for migration without writing or seeding storage',()=>{
  const original=JSON.stringify([{id:'real-trade',pnl:100}]),keys:Record<string,string>={'tuan-trader-trades:owner':original,'tuan-trader-demo-mode-v1:owner':'false'};
  const storage=Object.freeze({getItem:(key:string)=>keys[key]??null});
  expect(readLegacySource(storage,':owner')).toEqual({trades:[{id:'real-trade',pnl:100}],isDemo:false});
  expect(readLegacySource(storage,':other')).toEqual({trades:[],isDemo:true});expect(keys['tuan-trader-trades:owner']).toBe(original);
});
it('does not offer demo records as real migration data and never replaces malformed originals',()=>{
  const keys:Record<string,string>={'tuan-trader-trades':'[{"id":"sample"}]','tuan-trader-demo-mode-v1':'true'};
  expect(readLegacySource({getItem:k=>keys[k]??null})).toEqual({trades:[],isDemo:true});
  expect(()=>readLegacySource({getItem:()=>'{broken'})).toThrow();
});
