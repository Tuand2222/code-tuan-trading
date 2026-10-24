import type { Trade } from '../data/schema';
import type { Snapshot } from '../data/snapshot';
import { tradeFacts } from './trade';
export function tradeLifecycle(
  t: Trade,
  data: Snapshot,
): 'open' | 'missing' | 'pending' | 'reviewed' | 'relink' {
  if (t.status === 'open') return 'open';
  const setup = data.setups.find((s) => s.id === t.setupId);
  if (
    (t.setupId && (!setup || setup.disabledAt)) ||
    t.errorTagIds.some((id) => {
      const tag = data.errorTags.find((e) => e.id === id);
      return !tag || tag.disabledAt;
    }) ||
    t.checklist?.some((item) => !setup?.checklist.some((c) => c.id === item.criterionId))
  )
    return 'relink';
  const f = tradeFacts(t);
  if (!f.risk || !t.costsKnown) return 'missing';
  return t.review.done ? 'reviewed' : 'pending';
}
