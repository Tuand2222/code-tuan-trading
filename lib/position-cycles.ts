import {PositionProjection} from '../src/core/position-cycles.js';
import type {ReportTrade} from './governance-report';
/** Compatibility facade; Classic and V6 run the same execution projection. */
export {PositionProjection};
export const positionCycles=PositionProjection.closedCycles as <T extends ReportTrade>(receipts:T[])=>{closed:ReportTrade[];open:Array<{symbol:string;quantity:string;accountId?:string|null;complete:boolean}>};
