import { D, dec, sum } from './decimal';
import type { Account, CostItem, Cycle, Dec, ImportBatch, RealizedEvent, Risk, TradeOverlay } from './types';

export function fxRate(batch: ImportBatch | undefined, ccy: string): Dec | undefined {
  if (ccy === 'VND') return '1';
  const rate = batch?.fx.find(x => x.ccy === ccy)?.rateToVND;
  return rate !== undefined && D(rate).gt(0) ? rate : undefined;
}
export function valueCosts(costs: CostItem[], batch?: ImportBatch): CostItem[] {
  return costs.map(c => ({ ...c, batchId: c.batchId ?? batch?.batchId, rateToVND: c.rateToVND ?? fxRate(batch, c.ccy) }));
}
export function costsVND(costs: CostItem[]): Dec | undefined {
  if (costs.some(c => c.amount === undefined || c.rateToVND === undefined)) return undefined;
  return sum(costs.map(c => dec(D(c.amount!).mul(D(c.rateToVND!)))));
}
export function eventFinance(event: RealizedEvent, reportedNet?: Dec): RealizedEvent {
  const rate = event.fx?.rateToVND;
  const cost = costsVND(event.costs);
  const grossVND = event.gross !== undefined && rate ? dec(D(event.gross).mul(D(rate))) : undefined;
  const netVND = reportedNet !== undefined && rate ? dec(D(reportedNet).mul(D(rate))) : grossVND !== undefined && cost !== undefined ? dec(D(grossVND).minus(D(cost))) : undefined;
  const baseCosts = event.costs.map(c => c.amount === undefined ? undefined : c.ccy === event.ccy ? c.amount : rate && c.rateToVND ? dec(D(c.amount).mul(D(c.rateToVND)).div(D(rate))) : undefined);
  const net = reportedNet ?? (event.gross !== undefined && baseCosts.every(c => c !== undefined) ? dec(D(event.gross).minus(D(sum(baseCosts as Dec[])))) : undefined);
  return { ...event, grossVND, netVND, net, costCompleteness: event.costCompleteness === 'complete' && cost !== undefined && event.costs.every(c => c.origin === 'reported') ? 'complete' : 'partial' };
}
export function aggregateCycle(cycle: Cycle, events: RealizedEvent[]): Cycle {
  const own = events.filter(e => e.tradeId === cycle.tradeId && (!e.shadowed || cycle.shadowed));
  const aggregate = (key: 'gross' | 'net' | 'grossVND' | 'netVND') => own.length && own.every(e => e[key] !== undefined) ? sum(own.map(e => e[key]!)) : undefined;
  return { ...cycle, gross: aggregate('gross'), net: aggregate('net'), grossVND: aggregate('grossVND'), netVND: aggregate('netVND'), costs: own.flatMap(e => e.costs),
    costCompleteness: own.length && own.every(e => e.costCompleteness === 'complete') ? 'complete' : 'partial' };
}
export function reconcile(reported: Dec | undefined, computed: Dec | undefined, minorUnit: Dec = '1'): Cycle['reconciliation'] {
  if (reported === undefined || computed === undefined) return 'unverifiable';
  const tolerance = D(reported).abs().mul('0.001');
  return D(reported).minus(D(computed)).abs().lte(tolerance.gt(D(minorUnit)) ? tolerance : D(minorUnit)) ? 'reconciled' : 'mismatch';
}
export function resolveRisk(cycle: Cycle, account: Account, batches: ImportBatch[], overlay?: TradeOverlay, sourceStop?: { price?: Dec; origin?: string }): { risk: Risk; warnings: string[] } {
  const warnings: string[] = [];
  if (overlay?.riskOverrideVND !== undefined) {
    if (!D(overlay.riskOverrideVND).gt(0)) throw new Error('INVALID_RISK');
    return { risk: { amountVND: overlay.riskOverrideVND, origin: 'user-entered' }, warnings };
  }
  const stop = overlay?.stopLossPrice ?? sourceStop?.price;
  const origin = overlay?.stopOrigin ?? sourceStop?.origin;
  const opens = cycle.legs.filter(x => x.role === 'open');
  if (stop !== undefined) {
    const valid = cycle.direction === 'LONG' ? D(stop).lt(D(cycle.avgEntry)) : D(stop).gt(D(cycle.avgEntry));
    if (!valid) warnings.push('TRAILED_STOP_DETECTED');
    if (origin === 'reported-current') warnings.push('INITIAL_STOP_UNCONFIRMED');
    if (valid && origin === 'confirmed-initial' && opens.length === 1 && !cycle.adjustments?.length) {
      const distance = D(cycle.avgEntry).minus(D(stop)).abs();
      const batch = batches.find(b => b.batchId === cycle.sourceBatchIds[0]);
      const rate = fxRate(batch, account.quoteCcy);
      if (account.pnlModel === 'linear' && account.quoteCcy === account.baseCcy && rate) return { risk: { amountVND: dec(distance.mul(D(cycle.qtyOpened)).mul(D(account.contractMultiplier)).mul(D(rate))), origin: 'initial-stop', method: 'linear-model' }, warnings };
      if (cycle.avgExit !== undefined && cycle.grossVND !== undefined && !D(cycle.avgEntry).eq(D(cycle.avgExit)) && !D(cycle.grossVND).isZero()) {
        warnings.push('RISK_ESTIMATED_FROM_PNL');
        return { risk: { amountVND: dec(distance.div(D(cycle.avgEntry).minus(D(cycle.avgExit)).abs()).mul(D(cycle.grossVND).abs())), origin: 'initial-stop', method: 'implied-from-pnl' }, warnings };
      }
    }
  }
  const fixed = batches.filter(b => cycle.sourceBatchIds.includes(b.batchId) && b.fixedRiskVND !== undefined).map(b => b.fixedRiskVND!);
  if (fixed.length && fixed.every(v => D(v).eq(D(fixed[0]))) && D(fixed[0]).gt(0)) return { risk: { amountVND: fixed[0], origin: 'batch-fixed' }, warnings };
  if (fixed.length) warnings.push('CONFLICTING_BATCH_RISK');
  return { risk: { origin: 'none' }, warnings };
}
export function reanchorOverlays(cycles: Cycle[], overlays: TradeOverlay[]): TradeOverlay[] {
  return overlays.map(overlay => {
    const matches = cycles.map(c => ({ cycle: c, count: overlay.anchorFillIds.filter(id => c.sourceFillIds.includes(id)).length })).filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count || a.cycle.tradeId.localeCompare(b.cycle.tradeId));
    if (!matches.length) return { ...overlay, state: 'detached', attachedTradeId: undefined };
    // Retain original anchors during ambiguous splits, so later replay can recover the full intent.
    return { ...overlay, state: matches.length > 1 ? 'needs-attention' : 'attached', attachedTradeId: matches[0].cycle.tradeId,
      anchorFillIds: matches.length === 1 ? [...new Set([...overlay.anchorFillIds, ...matches[0].cycle.sourceFillIds])] : overlay.anchorFillIds };
  });
}
