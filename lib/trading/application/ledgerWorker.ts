/// <reference lib="webworker" />
import { deriveLedger } from './deriveLedger';
import type { LedgerSnapshot } from '../domain/types';
import type { Filters } from '../selectors';
self.onmessage = async ({ data }: MessageEvent<{id:number;version:number;ledger:LedgerSnapshot;filters:Filters}>) => {
  try { self.postMessage({id:data.id,value:await deriveLedger(data.ledger,data.version,data.filters)}); }
  catch(error) { self.postMessage({id:data.id,error:String(error)}); }
};
