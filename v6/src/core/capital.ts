import type { CashFlow, Journal, Trade } from '../data/schema';
import { analyze } from './analyze';
import { D, dec } from './money';

// Realized capital only. Flows at the same timestamp precede trading events.
export function capitalReport(
  journal: Journal,
  trades: Trade[],
  flows: CashFlow[],
  base?: ReturnType<typeof analyze>,
) {
  const events = (base ?? analyze(journal, trades, {}, [], { inference: false })).events;
  const timeline = [
    ...events.map((e) => ({
      id: e.id,
      tradeId: e.tradeId,
      time: e.time,
      order: 1,
      pnl: e.net,
      flow: undefined as string | undefined,
    })),
    ...flows
      .filter((f) => f.journalId === journal.id)
      .map((f) => ({
        id: f.id,
        tradeId: undefined as string | undefined,
        time: f.date,
        order: 0,
        pnl: undefined as string | undefined,
        flow: f.type === 'deposit' ? f.amount : dec(D(f.amount).neg()),
      })),
  ].sort(
    (a, b) =>
      Date.parse(a.time) - Date.parse(b.time) || a.order - b.order || a.id.localeCompare(b.id),
  );
  let balance = D(journal.startingBalance ?? '0');
  let known = journal.startingBalance !== undefined;
  let factor = D('1'),
    validReturn = known;
  const points = timeline.map((e) => {
    if (e.flow !== undefined) {
      balance = balance.plus(e.flow);
      if (balance.lt(0)) validReturn = false;
    } else if (e.pnl === undefined) {
      known = false;
      validReturn = false;
    } else {
      if (!known || balance.lte(0)) validReturn = false;
      else factor = factor.mul(D('1').plus(D(e.pnl).div(balance)));
      balance = balance.plus(e.pnl);
      if (balance.lt(0)) validReturn = false;
    }
    return {
      id: e.id,
      tradeId: e.tradeId,
      time: e.time,
      balance: known ? dec(balance) : null,
      twrPercent: validReturn ? dec(factor.minus(1).mul(100)) : null,
    };
  });
  return {
    balance: known ? dec(balance) : null,
    twrPercent: validReturn && timeline.length > 0 ? dec(factor.minus(1).mul(100)) : null,
    points,
  };
}
