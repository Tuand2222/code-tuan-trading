import { D } from '../domain/decimal';
import type { Cycle, Dec } from '../domain/types';
import { dateInZone, rMultiple } from './index';

export function tradeDims(cycle: Cycle, timezone = 'Asia/Ho_Chi_Minh', breakevenBand: Dec = '0') {
  const closeDate = cycle.closeTsUtc ? dateInZone(cycle.closeTsUtc, timezone) : undefined;
  let week: string | undefined, weekday: number | undefined;
  if (closeDate) {
    const day = new Date(`${closeDate}T00:00:00Z`); weekday = day.getUTCDay() || 7;
    day.setUTCDate(day.getUTCDate() + 4 - weekday);
    const year = day.getUTCFullYear(), first = new Date(Date.UTC(year, 0, 1));
    week = `${year}-W${String(Math.ceil(((day.getTime() - first.getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`;
  }
  const ts = cycle.openTsUtc ?? cycle.closeTsUtc;
  let session: string | undefined;
  if (ts) {
    const zone = cycle.market === 'stock' ? 'Asia/Ho_Chi_Minh' : 'UTC';
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts));
    const minutes = Number(parts.find(p => p.type === 'hour')!.value) * 60 + Number(parts.find(p => p.type === 'minute')!.value);
    session = cycle.market === 'stock' ? minutes >= 540 && minutes < 690 ? 'VN_AM' : minutes >= 780 && minutes < 900 ? 'VN_PM' : 'VN_OTHER' : minutes < 420 ? 'ASIA' : minutes < 780 ? 'EUROPE' : minutes < 1260 ? 'US' : 'OFF';
  }
  const h = cycle.holdMinutes, r = rMultiple(cycle);
  return { market: cycle.market, rootSymbol: cycle.rootSymbol, accountId: cycle.accountId, platform: cycle.platform, direction: cycle.direction,
    closeDate, week, month: closeDate?.slice(0, 7), weekday, session, sessionUsesCloseTime: !cycle.openTsUtc,
    holdBucket: h === undefined ? 'unknown' : h < 5 ? '<5m' : h < 60 ? '5–60m' : h < 240 ? '1–4h' : h < 1440 ? '4h–1d' : h < 7200 ? '1–5d' : h < 28800 ? '5–20d' : '>20d',
    rBucket: r === undefined ? 'unknown' : D(r).lte(-1) ? '≤−1' : D(r).lt(0) ? '(−1,0)' : D(r).lt(1) ? '[0,1)' : D(r).lt(2) ? '[1,2)' : D(r).lt(3) ? '[2,3)' : '≥3',
    outcome: cycle.netVND === undefined ? 'unknown' : D(cycle.netVND).abs().lte(D(breakevenBand)) ? 'breakeven' : D(cycle.netVND).gt(0) ? 'win' : 'loss',
    setupTag: cycle.overlay?.setupTag, reviewStatus: cycle.overlay?.reviewStatus ?? 'needs-review', riskKnown: r !== undefined,
    costsComplete: cycle.costCompleteness === 'complete', granularity: cycle.granularity, cycleStatus: cycle.status };
}
export type TradeDims = ReturnType<typeof tradeDims>;
