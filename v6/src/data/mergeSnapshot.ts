import { canonical, sha256 } from './backup';
import { validateSnapshot, type Snapshot } from './snapshot';

type Row = { id?: string; journalId?: string; slot?: number; [key: string]: unknown };
const key = (r: Row) => r.id ?? `${r.journalId}:${r.slot ?? ''}`;
const comparable = (table: string, row: Row) => {
  if (table !== 'journals') return canonical(row);
  return canonical(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'createdAt')));
};

// Never overwrite a conflicting record. Preserve its whole reference graph in
// an archived journal, which keeps alternative histories out of current totals.
export async function mergeSnapshots(current: Snapshot, incoming: Snapshot) {
  validateSnapshot(current);
  validateSnapshot(incoming);
  const next = structuredClone(current);
  const report = { added: 0, duplicates: 0, conflictJournals: 0 };
  for (const source of incoming.sources) {
    const old = next.sources.find((s) => s.id === source.id);
    if (old && old.raw !== source.raw) throw Error('SOURCE_ID_CONFLICT');
    if (!old) next.sources.push(source);
  }
  for (const journal of incoming.journals) {
    const part: Record<string, Row[]> = Object.fromEntries(
      Object.entries(incoming)
        .filter(([t]) => t !== 'sources')
        .map(([t, rows]) => [
          t,
          (rows as Row[]).filter((r) =>
            t === 'journals' ? r.id === journal.id : r.journalId === journal.id,
          ),
        ]),
    );
    const conflict = Object.entries(part).some(([table, rows]) =>
      rows.some((row) => {
        const old = (next[table as keyof Snapshot] as Row[]).find((r) => key(r) === key(row));
        return old && comparable(table, old) !== comparable(table, row);
      }),
    );
    let prepared = part;
    if (conflict) {
      report.conflictJournals++;
      const stable = {
        ...part,
        journals: part.journals.map((j) => JSON.parse(comparable('journals', j))),
      };
      const prefix = 'merged:' + (await sha256(canonical(stable))).slice(0, 20) + ':';
      const remap = new Map<string, string>();
      const collect = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) {
            if (k === 'id' && typeof v === 'string' && !remap.has(v))
              remap.set(v, prefix + remap.size);
            collect(v);
          }
        }
      };
      collect(part);
      const rewrite = (value: unknown): unknown => {
        if (typeof value === 'string') return remap.get(value) ?? value;
        if (Array.isArray(value)) return value.map(rewrite);
        if (value && typeof value === 'object')
          return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
              k,
              ['body', 'raw', 'name', 'symbol', 'caption', 'url', 'emotion'].includes(k)
                ? v
                : rewrite(v),
            ]),
          );
        return value;
      };
      prepared = rewrite(part) as typeof part;
      prepared.journals = prepared.journals.map((j) => ({
        ...j,
        name: String(j.name).slice(0, 174) + ' (bản khác đã lưu)',
        archivedAt:
          part.trades.map((t) => String(t.createdAt)).sort()[0] ?? '1970-01-01T00:00:00.000Z',
      }));
    }
    for (const [table, rows] of Object.entries(prepared)) {
      const target = next[table as keyof Snapshot] as Row[];
      for (const row of rows) {
        const old = target.find((r) => key(r) === key(row));
        if (old) {
          if (comparable(table, old) !== comparable(table, row)) throw Error('MERGE_CONFLICT');
          if (table === 'trades') report.duplicates++;
        } else {
          target.push(row);
          if (table === 'trades') report.added++;
        }
      }
    }
  }
  return { data: validateSnapshot(next), report };
}
