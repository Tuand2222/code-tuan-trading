import type { Trade } from '../data/schema';
import { tradeFacts } from './trade';
import { D } from './money';
export interface Filters {
  journal: string;
  from: string;
  to: string;
  operator: 'AND' | 'OR';
  market: string;
  symbol: string;
  setup: string;
  side: string;
  error: string;
  result: string;
  review: string;
  tag: string;
}
export const emptyFilters: Filters = {
  journal: '',
  from: '',
  to: '',
  operator: 'AND',
  market: '',
  symbol: '',
  setup: '',
  side: '',
  error: '',
  result: '',
  review: '',
  tag: '',
};
export function parseHash(hash: string): { page: string; filters: Filters } {
  const [route, query = ''] = hash.replace(/^#/, '').split('?');
  const p = new URLSearchParams(query);
  const filters = { ...emptyFilters };
  for (const key of Object.keys(filters) as (keyof Filters)[])
    if (key !== 'operator') filters[key] = (p.get(key) ?? '').slice(0, 256);
  filters.operator = p.get('operator') === 'OR' ? 'OR' : 'AND';
  for (const key of ['from', 'to'] as const)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters[key])) filters[key] = '';
  return { page: route || 'overview', filters };
}
export function filterHash(page: string, filters: Filters) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) p.set(key, value);
  return '#' + page + '?' + p.toString();
}
// Journal isolation is mandatory even for OR. Dates are applied to realized events
// in analyze(), never to the complete trade before calculating its cost basis.
export function selectTrades(trades: Trade[], f: Filters, journalId: string) {
  return trades.filter((t) => {
    if (t.journalId !== journalId) return false;
    const tests: boolean[] = [];
    if (f.market) tests.push(t.market === f.market);
    if (f.symbol) tests.push(t.symbol.toUpperCase().includes(f.symbol.toUpperCase()));
    if (f.setup) tests.push(t.setupId === f.setup);
    if (f.side) tests.push(t.side === f.side);
    if (f.error) tests.push(t.errorTagIds.includes(f.error));
    if (f.review) tests.push(t.review.done === (f.review === 'reviewed'));
    if (f.tag) tests.push(t.tags.includes(f.tag));
    if (f.result) {
      const net = tradeFacts(t).net;
      tests.push(
        net !== undefined &&
          t.status === 'closed' &&
          (f.result === 'win' ? D(net).gt(0) : f.result === 'loss' ? D(net).lt(0) : D(net).eq(0)),
      );
    }
    return !tests.length || (f.operator === 'AND' ? tests.every(Boolean) : tests.some(Boolean));
  });
}
export function acceptsShortcut(target: EventTarget | null) {
  return (
    !(target instanceof Element) ||
    !target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')
  );
}
