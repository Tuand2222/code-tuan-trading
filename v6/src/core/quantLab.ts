import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import type { Trade } from '../data/schema';
import { tradeFacts } from './trade';
import { D, dec } from './money';

export const quantSettingsSchema = z.object({
  pnl: z.enum(['net', 'gross']).default('net'),
  frictionR: z.number().min(0).max(10).default(0),
  sqnMode: z.enum(['cap100', 'unlimited', 'rolling100']).default('cap100'),
  dateBasis: z.enum(['entry', 'exit']).default('exit'),
  minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(60),
  includeBreakeven: z.boolean().default(true),
  capital: z.number().min(0).max(1e15).default(0),
  assumeMissingRisk: z.boolean().default(false),
  baselineMode: z.enum(['money', 'percent']).default('money'),
  baseline: z.number().min(0).max(1e15).default(0),
  riskPercent: z.number().min(0).max(100).default(1),
  unit: z.enum(['R', 'money', 'percent', 'pips', 'ticks']).default('R'),
  instruments: z
    .record(
      z.string(),
      z.object({
        pipSize: z.number().positive().optional(),
        tickSize: z.number().positive().optional(),
        multiplier: z.number().positive().optional(),
      }),
    )
    .default({}),
});
export type QuantSettings = z.infer<typeof quantSettingsSchema>;
export const defaultQuantSettings = () => quantSettingsSchema.parse({});
export interface QuantObservation {
  id: string;
  symbol: string;
  market: string;
  setup: string;
  openTime: string;
  closeTime: string;
  gross: string | null;
  net: string | null;
  risk: string | null;
  mfe: string | null;
  mae: string | null;
  entryTimeKnown?: boolean;
  exitTimeKnown?: boolean;
  exitDate?: string;
  quantity?: string;
  multiplier?: string;
}
export function observeTrades(trades: Trade[]): QuantObservation[] {
  return trades
    .filter((t) => t.status === 'closed')
    .flatMap((t) => {
      const f = tradeFacts(t);
      if (!f.closeTime) return [];
      let mfe: string | null = null,
        mae: string | null = null;
      // Price extrema are authoritative only for one real entry and exit. They do
      // not describe running P&L through scale-ins/outs or synthetic migration legs.
      if (
        t.legs.length === 2 &&
        !t.legs.some((l) => l.synthetic) &&
        t.highestPrice &&
        t.lowestPrice &&
        f.avgExit
      ) {
        const hi = D(t.highestPrice),
          lo = D(t.lowestPrice),
          entry = D(f.avgEntry);
        if (hi.gte(entry) && hi.gte(f.avgExit) && lo.lte(entry) && lo.lte(f.avgExit)) {
          const scale = D(t.legs[0].quantity).mul(t.multiplier ?? '1');
          mfe = dec((t.side === 'long' ? hi.minus(entry) : entry.minus(lo)).mul(scale));
          mae = dec((t.side === 'long' ? entry.minus(lo) : hi.minus(entry)).mul(scale));
        }
      }
      return [
        {
          id: t.id,
          symbol: t.symbol,
          market: t.market,
          setup: t.setupId ?? '',
          openTime: f.openTime,
          closeTime: f.closeTime,
          gross: f.gross,
          net: f.net ?? null,
          risk: f.risk ?? null,
          mfe,
          mae,
          quantity: dec(
            t.legs.filter((l) => l.kind === 'out').reduce((n, l) => n.plus(l.quantity), D('0')),
          ),
          multiplier: t.multiplier ?? '1',
        },
      ];
    });
}
export const mean = (a: number[]) => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : null);
export function rStatistics(a: number[], mode: QuantSettings['sqnMode'] = 'cap100') {
  const avg = mean(a);
  const sd =
    a.length > 1 && avg !== null
      ? Math.sqrt(a.reduce((n, x) => n + (x - avg) ** 2, 0) / (a.length - 1))
      : null;
  const sqnSample = mode === 'rolling100' ? a.slice(-100) : a;
  const sqnMean = mean(sqnSample);
  const sqnSD =
    sqnSample.length > 1 && sqnMean !== null
      ? Math.sqrt(sqnSample.reduce((n, x) => n + (x - sqnMean) ** 2, 0) / (sqnSample.length - 1))
      : null;
  const sqn =
    sqnSD && sqnMean !== null
      ? (Math.sqrt(mode === 'cap100' ? Math.min(a.length, 100) : sqnSample.length) * sqnMean) /
        sqnSD
      : null;
  const profit = a.reduce((n, x) => n + Math.max(0, x), 0);
  const loss = a.reduce((n, x) => n + Math.max(0, -x), 0);
  const downside = a.length
    ? Math.sqrt(a.reduce((n, x) => n + Math.min(0, x) ** 2, 0) / a.length)
    : 0;
  return {
    n: a.length,
    mean: avg,
    sd,
    sqn,
    sqnN: sqnSample.length,
    pf: loss ? profit / loss : null,
    noLoss: profit > 0 && loss === 0,
    sharpe: sd && avg !== null ? avg / sd : null,
    sortino: downside && avg !== null ? avg / downside : null,
  };
}
export function sqnLabel(value: number | null, n: number) {
  if (value === null) return 'Chưa xác định';
  if (n < 30) return 'Mẫu nhỏ';
  return value < 1.6
    ? 'Kém'
    : value < 2
      ? 'Dưới trung bình'
      : value < 2.5
        ? 'Trung bình'
        : value < 3
          ? 'Tốt'
          : value < 5
            ? 'Xuất sắc'
            : 'Cần kiểm tra mẫu';
}
function rReport(
  input: QuantObservation[],
  settings: QuantSettings,
  timezone: string,
  scope: { from?: string; to?: string } = {},
) {
  const prefs = quantSettingsSchema.parse(settings);
  const fallback =
    prefs.baselineMode === 'money' ? prefs.baseline : (prefs.capital * prefs.riskPercent) / 100;
  const time = (r: QuantObservation) => (prefs.dateBasis === 'entry' ? r.openTime : r.closeTime);
  const dateCache = new Map<string, string>();
  const local = (ts: string) => {
    let result = dateCache.get(ts);
    if (!result) {
      result = formatInTimeZone(ts, timezone, 'yyyy-MM-dd HH:mm i');
      dateCache.set(ts, result);
    }
    return result;
  };
  const rows = input
    .filter((r) => {
      if (prefs.dateBasis === 'entry' && r.entryTimeKnown === false) return false;
      const date =
        prefs.dateBasis === 'exit' && r.exitTimeKnown === false && r.exitDate
          ? r.exitDate
          : local(time(r)).slice(0, 10);
      return (!scope.from || date >= scope.from) && (!scope.to || date <= scope.to);
    })
    .slice()
    .sort((a, b) => a.closeTime.localeCompare(b.closeTime) || a.id.localeCompare(b.id))
    .map((o) => {
      const actualRisk = o.risk !== null && D(o.risk).gt(0) ? o.risk : null;
      const risk =
        actualRisk ?? (prefs.assumeMissingRisk && fallback > 0 ? String(fallback) : null);
      const pnl = prefs.pnl === 'net' ? o.net : o.gross;
      const ratio = pnl !== null && risk ? Number(D(pnl).div(risk)) - prefs.frictionR : null;
      const r = ratio !== null && Number.isFinite(ratio) ? ratio : null;
      const mfe = o.mfe !== null && risk ? Number(D(o.mfe).div(risk)) : null;
      const mae = o.mae !== null && risk ? Number(D(o.mae).div(risk)) : null;
      return {
        ...o,
        r,
        mfeR: mfe,
        maeR: mae,
        assumed: !actualRisk && risk !== null,
        local: local(time(o)),
        riskUsed: risk,
      };
    });
  const valid = rows.filter((r) => r.r !== null);
  const rs = valid.map((r) => r.r!);
  const stats = rStatistics(rs, prefs.sqnMode);
  if (prefs.sqnMode === 'rolling100' && valid.slice(-100).some((r) => r.exitTimeKnown === false))
    stats.sqn = null;
  let equity = 0,
    peak = 0,
    drawdown = 0,
    incomplete = false;
  const curve = rows.map((row) => {
    if (row.r === null || row.exitTimeKnown === false) incomplete = true;
    else equity += row.r;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
    return {
      id: row.id,
      equity: incomplete ? null : equity,
      dd: incomplete ? null : peak - equity,
    };
  });
  const excursions = valid.filter((r) => r.mfeR !== null && r.maeR !== null);
  const captures = excursions
    .filter((r) => r.r! > 0 && r.mfeR! > 0)
    .map((r) => (r.r! / r.mfeR!) * 100);
  const hourly = new Map<string, { weekday: number; minute: number; sum: number; ids: string[] }>();
  valid.forEach((r) => {
    if (
      (prefs.dateBasis === 'entry' && r.entryTimeKnown === false) ||
      (prefs.dateBasis === 'exit' && r.exitTimeKnown === false)
    )
      return;
    const minute =
      Math.floor(
        (Number(r.local.slice(11, 13)) * 60 + Number(r.local.slice(14, 16))) / prefs.minutes,
      ) * prefs.minutes;
    const weekday = Number(r.local.slice(-1));
    const key = weekday + ':' + minute;
    const cell = hourly.get(key) ?? { weekday, minute, sum: 0, ids: [] };
    cell.sum += r.r!;
    cell.ids.push(r.id);
    hourly.set(key, cell);
  });
  const lo = rs.length ? rs.reduce((a, b) => Math.min(a, b), Infinity) : 0,
    hi = rs.length ? rs.reduce((a, b) => Math.max(a, b), -Infinity) : 0;
  const start = lo === hi ? lo - 0.5 : lo,
    width = (lo === hi ? 1 : hi - lo) / 12;
  const bins = Array.from({ length: 12 }, (_, i) => ({
    from: start + i * width,
    to: start + (i + 1) * width,
    ids: [] as string[],
    normal: 0,
  }));
  valid.forEach((r) =>
    bins[Math.max(0, Math.min(11, Math.floor((r.r! - start) / width)))].ids.push(r.id),
  );
  bins.forEach((b) => {
    const x = (b.from + b.to) / 2;
    b.normal =
      stats.sd && stats.mean !== null
        ? (Math.exp(-0.5 * ((x - stats.mean) / stats.sd) ** 2) /
            (stats.sd * Math.sqrt(2 * Math.PI))) *
          width *
          rs.length
        : 0;
  });
  const rolling = rows.map((r, i) => {
    const window = rows.slice(Math.max(0, i - 29), i + 1);
    const stats = rStatistics(
      window.filter((x) => x.r !== null).map((x) => x.r!),
      prefs.sqnMode,
    );
    return {
      id: r.id,
      ...stats,
      sqn: window.some((x) => x.r === null || x.exitTimeKnown === false) ? null : stats.sqn,
    };
  });
  const m2 =
    stats.mean === null || !rs.length
      ? 0
      : rs.reduce((s, r) => s + (r - stats.mean!) ** 2, 0) / rs.length;
  const skew =
    m2 && rs.length >= 3
      ? rs.reduce((s, r) => s + (r - stats.mean!) ** 3, 0) / rs.length / m2 ** 1.5
      : null;
  const kurtosis =
    m2 && rs.length >= 4
      ? rs.reduce((s, r) => s + (r - stats.mean!) ** 4, 0) / rs.length / m2 ** 2 - 3
      : null;
  const winning = rs.filter((r) => r > 0).length,
    decided = rs.filter((r) => r !== 0).length;
  return {
    rows,
    stats,
    excursions,
    capture: mean(captures),
    captureN: captures.length,
    missingRisk: rows.filter((r) => r.risk === null).length,
    missingCosts: rows.filter((r) => r.net === null).length,
    assumed: rows.filter((r) => r.assumed).length,
    complete: !incomplete && rows.length > 0,
    maxDD: !incomplete && rows.length ? drawdown : null,
    recovery: !incomplete && drawdown ? equity / drawdown : null,
    winRate: (prefs.includeBreakeven ? rs.length : decided)
      ? (winning / (prefs.includeBreakeven ? rs.length : decided)) * 100
      : null,
    bins,
    heat: [...hourly.values()].map((c) => ({ ...c, mean: c.sum / c.ids.length })),
    curve,
    rolling,
    skew,
    kurtosis,
    simulated: prefs.frictionR > 0 || (prefs.assumeMissingRisk && rows.some((r) => r.assumed)),
  };
}
export function quantReport(
  input: QuantObservation[],
  settings: QuantSettings,
  timezone: string,
  scope: { from?: string; to?: string } = {},
) {
  const s = quantSettingsSchema.parse(settings),
    base = rReport(input, s, timezone, scope);
  const unitLabel = { R: 'R', money: 'tiền', percent: '% vốn đầu', pips: 'Pips', ticks: 'Ticks' }[
    s.unit
  ];
  if (s.unit === 'R')
    return {
      ...base,
      unitLabel,
      rStats: base.stats,
      missingUnit: base.rows.filter((r) => r.r === null).length,
    };
  const baseById = new Map(base.rows.map((r) => [r.id, r]));
  const mapped = input.map((o) => {
    const cfg = s.instruments[o.symbol.toUpperCase()];
    const step = s.unit === 'pips' ? cfg?.pipSize : cfg?.tickSize;
    const denominator =
      s.unit === 'money'
        ? D('1')
        : s.unit === 'percent'
          ? s.capital > 0
            ? D(String(s.capital)).div(100)
            : null
          : step && o.quantity && D(o.quantity).gt(0) && (o.multiplier || cfg?.multiplier)
            ? D(o.quantity)
                .mul(o.multiplier ?? cfg!.multiplier!)
                .mul(step)
            : null;
    const original = baseById.get(o.id);
    const friction =
      s.frictionR > 0 && original?.riskUsed ? D(original.riskUsed).mul(s.frictionR) : D('0');
    const knownFriction = s.frictionR === 0 || !!original?.riskUsed;
    const convert = (value: string | null, charge = false) =>
      value !== null && denominator && knownFriction
        ? dec(
            D(value)
              .minus(charge ? friction : 0)
              .div(denominator),
          )
        : null;
    return {
      ...o,
      gross: convert(o.gross, true),
      net: convert(o.net, true),
      mfe: convert(o.mfe),
      mae: convert(o.mae),
      risk: '1',
    };
  });
  const display = rReport(
    mapped,
    { ...s, frictionR: 0, assumeMissingRisk: false },
    timezone,
    scope,
  );
  const originalById = new Map(base.rows.map((r) => [r.id, r]));
  return {
    ...display,
    unitLabel,
    rStats: base.stats,
    rolling: base.rolling,
    stats: {
      ...display.stats,
      sqn: base.stats.sqn,
      sqnN: base.stats.sqnN,
      sharpe: base.stats.sharpe,
      sortino: base.stats.sortino,
    },
    rows: display.rows.map((r) => ({
      ...r,
      risk: originalById.get(r.id)?.risk ?? null,
      riskUsed: originalById.get(r.id)?.riskUsed ?? null,
      assumed: originalById.get(r.id)?.assumed ?? false,
    })),
    missingUnit: display.rows.filter((r) => r.r === null).length,
    missingRisk: base.missingRisk,
    missingCosts: base.missingCosts,
    assumed: base.assumed,
    simulated: base.simulated,
  };
}
export type QuantReport = ReturnType<typeof quantReport>;
