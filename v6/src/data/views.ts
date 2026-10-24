import Dexie, { type Table } from 'dexie';
import { parseHash, filterHash, type Filters } from '../core/filters';
export interface SavedView {
  name: string;
  hash: string;
}
class ViewRepository extends Dexie {
  views!: Table<SavedView, string>;
  meta!: Table<{ key: string; value: string }, string>;
  constructor() {
    super('tuan-trader-v6-views');
    this.version(1).stores({ views: 'name' });
    this.version(2)
      .stores({ views: 'name', meta: 'key' })
      .upgrade(async (tx) => {
        await tx.table('meta').put({
          key: 'before-v2-views',
          value: JSON.stringify(await tx.table('views').toArray()),
        });
      });
  }
}
export const viewRepository = new ViewRepository();
export const saveView = (name: string, filters: Filters) => {
  const label = name.trim();
  if (!label || label.length > 80) throw Error('INVALID_VIEW_NAME');
  return viewRepository.views.put({ name: label, hash: filterHash('workspace', filters) });
};
export const readView = (view: SavedView) => parseHash(view.hash).filters;
