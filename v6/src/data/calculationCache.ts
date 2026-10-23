import Dexie, { type Table } from 'dexie';
interface Calculation {
  key: string;
  at: number;
  value: unknown;
}
class CalculationCache extends Dexie {
  rows!: Table<Calculation, string>;
  constructor() {
    super('tuan-trader-v6-derived-cache');
    this.version(1).stores({ rows: 'key,at' });
  }
}
const cache = new CalculationCache();
export async function readCalculation(key: string) {
  try {
    return (await cache.rows.get(key))?.value;
  } catch {
    return undefined;
  }
}
export async function cacheCalculation(key: string, value: unknown) {
  try {
    await cache.rows.put({ key, at: Date.now(), value });
    const old = await cache.rows.orderBy('at').reverse().offset(3).primaryKeys();
    if (old.length) await cache.rows.bulkDelete(old);
  } catch {
    /* Derived data is disposable; the ledger remains the source. */
  }
}
