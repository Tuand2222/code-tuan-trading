import { expect, it } from 'vitest';
import original from '../golden/fixture-30-trades.json';
import { migrateV3 } from '../../src/data/migrateV3';
import { cloneJournalTemplate, archiveJournal } from '../../src/data/journalCommands';
import { canonical } from '../../src/data/backup';

it('clones configuration with distinct IDs, no capital or trades and preserves the original ledger', async () => {
  const { data } = await migrateV3(JSON.stringify(original));
  data.journals[0].startingBalance = '100';
  const before = canonical(data);
  const result = cloneJournalTemplate(data, data.journals[0].id, 'New journal');
  expect(canonical(data)).toBe(before);
  expect(result.journal.startingBalance).toBeUndefined();
  expect(result.journal.isDemo).toBe(false);
  expect(result.journal.currency).toBe(data.journals[0].currency);
  expect(result.data.trades).toEqual(data.trades);
  expect(result.data.setups.filter((s) => s.journalId === result.journal.id)).toHaveLength(
    data.setups.length,
  );
  expect(new Set(result.data.setups.map((s) => s.id)).size).toBe(result.data.setups.length);
  expect(() => archiveJournal(data, data.journals[0].id, true)).toThrow('LAST_ACTIVE_JOURNAL');
  const archived = archiveJournal(result.data, data.journals[0].id, true);
  expect(archived.journals[0].archivedAt).toBeTruthy();
  expect(archived.trades).toEqual(data.trades);
  expect(
    archiveJournal(archived, data.journals[0].id, false).journals[0].archivedAt,
  ).toBeUndefined();
});
