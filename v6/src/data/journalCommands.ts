import { journalSchema } from './schema';
import { validateSnapshot, type Snapshot } from './snapshot';

export function cloneJournalTemplate(data: Snapshot, sourceId: string, name: string) {
  const source = data.journals.find((j) => j.id === sourceId);
  if (!source) throw Error('JOURNAL_NOT_FOUND');
  const journal = journalSchema.parse({
    ...source,
    id: crypto.randomUUID(),
    name,
    startingBalance: undefined,
    archivedAt: undefined,
    isDemo: false,
    createdAt: new Date().toISOString(),
  });
  const ids = new Map<string, string>();
  const setups = data.setups
    .filter((s) => s.journalId === sourceId)
    .map((s) => {
      const id = crypto.randomUUID();
      ids.set(s.id, id);
      return { ...structuredClone(s), id, journalId: journal.id };
    });
  const errors = data.errorTags
    .filter((e) => e.journalId === sourceId)
    .map((e) => ({ ...structuredClone(e), id: crypto.randomUUID(), journalId: journal.id }));
  const plan = data.plans.find((p) => p.journalId === sourceId);
  return {
    journal,
    data: validateSnapshot({
      ...data,
      journals: [...data.journals, journal],
      setups: [...data.setups, ...setups],
      errorTags: [...data.errorTags, ...errors],
      plans: plan
        ? [
            ...data.plans,
            {
              ...structuredClone(plan),
              journalId: journal.id,
              allowedSetupIds: plan.allowedSetupIds.map((id) => ids.get(id)!),
            },
          ]
        : data.plans,
    }),
  };
}
export function archiveJournal(data: Snapshot, id: string, archived: boolean) {
  if (!data.journals.some((j) => j.id === id)) throw Error('JOURNAL_NOT_FOUND');
  if (archived && data.journals.filter((j) => !j.archivedAt).length <= 1)
    throw Error('LAST_ACTIVE_JOURNAL');
  return validateSnapshot({
    ...data,
    journals: data.journals.map((j) =>
      j.id === id
        ? {
            ...j,
            archivedAt: archived ? new Date().toISOString() : undefined,
          }
        : j,
    ),
  });
}
