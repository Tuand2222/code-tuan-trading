import type { ErrorTag, Setup, Trade } from '../data/schema';
import { tradeFacts } from './trade';
import { compliance } from './advanced';
export function behavior(trades: Trade[], errors: ErrorTag[], setups: Setup[]) {
  const tags = new Map(errors.map((e) => [e.id, e]));
  const selected = (t: Trade) =>
    Object.values(t.stageChips ?? {})
      .flat()
      .map((id) => tags.get(id))
      .filter((e) => e?.journalId === t.journalId);
  const ordered = trades
    .map((t) => ({ t, f: tradeFacts(t) }))
    .filter((x) => x.f.closeTime)
    .sort((a, b) => a.f.closeTime!.localeCompare(b.f.closeTime!) || a.t.id.localeCompare(b.t.id));
  return ordered.map(({ t, f }, i) => {
    const negative = selected(t).some((e) => e?.tone === 'neg');
    const score = (['entry', 'management', 'exit'] as const).reduce((n, stage) => {
      const chips = (t.stageChips?.[stage] ?? [])
        .map((id) => tags.get(id))
        .filter((e) => e?.journalId === t.journalId);
      return (
        n +
        (chips.some((e) => e?.tone === 'neg') ? -1 : chips.some((e) => e?.tone === 'pos') ? 1 : 0)
      );
    }, 0);
    const window = ordered.slice(Math.max(0, i - 19), i + 1),
      observed = window.filter((x) => Object.values(x.t.stageChips ?? {}).flat().length > 0);
    return {
      id: t.id,
      time: f.closeTime!,
      score,
      negative,
      observed: selected(t).length > 0,
      efficiency:
        observed.length === 20
          ? (100 * observed.filter((x) => !selected(x.t).some((e) => e?.tone === 'neg')).length) /
            20
          : null,
      n: observed.length,
      of: window.length,
      checklist: compliance(
        t,
        setups.find((s) => s.id === t.setupId),
      ),
    };
  });
}
export function milestones(
  trades: Trade[],
  notes: number,
  backups: boolean,
  setups: Setup[],
  errors: ErrorTag[],
) {
  const facts = trades.map(tradeFacts),
    b = behavior(trades, errors, setups);
  const goals: [string, number, number][] = [
    ['Lệnh đầu tiên', trades.length, 1],
    ['20 lệnh trong nhật ký', trades.length, 20],
    ['50 lệnh có dữ liệu', trades.length, 50],
    ['20 lệnh đã review', trades.filter((t) => t.review.done).length, 20],
    ['20 lệnh đủ 1R và phí', facts.filter((f) => f.r !== undefined).length, 20],
    ['10 lệnh có checklist', b.filter((x) => x.checklist !== null).length, 10],
    [
      '10 lệnh có nhận xét 3 khâu',
      trades.filter((t) =>
        (['entry', 'management', 'exit'] as const).every((k) => t.stageChips?.[k].length),
      ).length,
      10,
    ],
    ['7 ghi chú phiên', notes, 7],
    ['Sao lưu ngoài thiết bị', backups ? 1 : 0, 1],
  ];
  return goals.map(([name, value, target]) => ({
    name,
    value,
    target,
    progress: Math.min(100, (100 * value) / target),
    complete: value >= target,
  }));
}
