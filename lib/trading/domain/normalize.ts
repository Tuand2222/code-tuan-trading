import { D, dec, positive } from './decimal';
import type { CashEvent, CostItem, Fill } from './types';
const utc = (ts: string) => new Date(ts).toISOString();
function cost(c: CostItem): CostItem { return { ...c, ccy: c.ccy.trim().toUpperCase(), amount: c.amount === undefined ? undefined : dec(D(c.amount)), rateToVND: c.rateToVND === undefined ? undefined : positive(c.rateToVND) }; }
export function normalizeFill(fill: Fill): Fill {
  const base = { ...fill, symbol: fill.symbol.trim().toUpperCase(), rootSymbol: fill.rootSymbol.trim().toUpperCase(), qty: positive(fill.qty, 'quantity'), costs: fill.costs.map(cost) };
  if (base.role === 'fill') return { ...base, tsUtc: utc(base.tsUtc), price: positive(base.price, 'price'), seq: base.seq === undefined ? undefined : BigInt(base.seq).toString(),
    reportedRealized: base.reportedRealized ? { ...base.reportedRealized, ccy: base.reportedRealized.ccy.toUpperCase(), gross: base.reportedRealized.gross === undefined ? undefined : dec(D(base.reportedRealized.gross)), net: base.reportedRealized.net === undefined ? undefined : dec(D(base.reportedRealized.net)) } : undefined };
  const common = { ...base, closeTsUtc: utc(base.closeTsUtc), closePrice: positive(base.closePrice), ccy: base.ccy.trim().toUpperCase(), reportedGross: base.reportedGross === undefined ? undefined : dec(D(base.reportedGross)), reportedNet: base.reportedNet === undefined ? undefined : dec(D(base.reportedNet)) };
  if (common.role === 'reported-position') {
    if (Date.parse(common.openTsUtc) > Date.parse(common.closeTsUtc)) throw new Error('CLOSE_BEFORE_OPEN');
    return { ...common, openTsUtc: utc(common.openTsUtc), openPrice: positive(common.openPrice), stopLossPrice: common.stopLossPrice === undefined ? undefined : positive(common.stopLossPrice) };
  }
  return { ...common, avgCostPrice: positive(common.avgCostPrice) };
}
export function normalizeCash(event: CashEvent): CashEvent {
  const amount = dec(D(event.amount));
  if (['deposit', 'withdrawal'].includes(event.kind)) positive(amount);
  return { ...event, amount, tsUtc: utc(event.tsUtc), ccy: event.ccy.trim().toUpperCase(), symbol: event.symbol?.trim().toUpperCase() };
}
