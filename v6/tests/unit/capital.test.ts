import { expect, it } from 'vitest';
import original from '../golden/fixture-30-trades.json';
import { migrateV3 } from '../../src/data/migrateV3';
import { capitalReport } from '../../src/core/capital';
import type { Trade, CashFlow } from '../../src/data/schema';

async function fixture() {
  const { data } = await migrateV3(JSON.stringify(original));
  const journal = { ...data.journals[0], startingBalance: '100' };
  const trade = (id: string, day: string, gain: string): Trade => ({
    ...data.trades[0],
    id,
    multiplier: '1',
    lotSize: '1',
    costsKnown: true,
    costs: { commission: '0', tax: '0', funding: '0', swap: '0', other: '0' },
    legs: [
      {
        id: id + 'in',
        kind: 'in',
        time: `2026-10-${day}T09:00:00.000Z`,
        price: '100',
        quantity: '1',
      },
      {
        id: id + 'out',
        kind: 'out',
        time: `2026-10-${day}T10:00:00.000Z`,
        price: String(100 + Number(gain)),
        quantity: '1',
      },
    ],
  });
  const flow: CashFlow = {
    id: 'flow',
    journalId: journal.id,
    date: '2026-10-02T10:00:00.000Z',
    type: 'deposit',
    amount: '110',
  };
  return { journal, trade, flow };
}
it('removes deposits from TWR and preserves actual realized capital', async () => {
  const { journal, trade, flow } = await fixture();
  const trades = [trade('a', '01', '10'), trade('b', '03', '22')];
  const report = capitalReport(journal, trades, [flow]);
  expect(report.balance).toBe('242');
  expect(Number(report.twrPercent)).toBeCloseTo(21, 10);
  expect(capitalReport(journal, trades, []).twrPercent).toBe('32');
  expect(capitalReport(journal, trades, [{ ...flow, journalId: 'another' }]).balance).toBe('132');
});
it('applies simultaneous withdrawals first and refuses missing/invalid capital or costs', async () => {
  const { journal, trade, flow } = await fixture();
  const trades = [trade('a', '03', '10')];
  const withdrawal = {
    ...flow,
    type: 'withdrawal' as const,
    amount: '50',
    date: '2026-10-03T10:00:00.000Z',
  };
  expect(capitalReport(journal, trades, [withdrawal]).twrPercent).toBe('20');
  expect(
    capitalReport(journal, trades, [{ ...withdrawal, date: withdrawal.date.replace('.000', '') }])
      .twrPercent,
  ).toBe('20');
  expect(capitalReport({ ...journal, startingBalance: undefined }, trades, []).balance).toBeNull();
  expect(capitalReport(journal, [{ ...trades[0], costsKnown: false }], []).twrPercent).toBeNull();
  expect(capitalReport(journal, trades, [{ ...withdrawal, amount: '200' }]).twrPercent).toBeNull();
  expect(
    capitalReport({ ...journal, startingBalance: '0' }, trades, [{ ...flow, amount: '100' }])
      .twrPercent,
  ).toBe('10');
  expect(capitalReport(journal, [], [flow]).twrPercent).toBe('0');
});
