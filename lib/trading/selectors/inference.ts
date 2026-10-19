import { finiteNumber } from '../domain/decimal';
import type { Cycle } from '../domain/types';
import { rMultiple, validRiskTrades } from './index';

export function mulberry32(seed: number) {
  return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function wilson(wins: number, n: number): [number, number] | null {
  if (!Number.isInteger(n) || !Number.isInteger(wins) || n <= 0 || wins < 0 || wins > n) return null;
  const z = 1.959963984540054, p = wins / n, denominator = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denominator, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator;
  return [wins === 0 ? 0 : Math.max(0, center - half), wins === n ? 1 : Math.min(1, center + half)];
}
export function bootstrapMean(values: number[], seed = 2103, iterations = 2000): [number, number] | null {
  if (!values.length || values.some(v => !Number.isFinite(v))) return null;
  const random = mulberry32(seed), means: number[] = [];
  for (let i = 0; i < iterations; i++) { let total = 0; for (let j = 0; j < values.length; j++) total += values[Math.floor(random() * values.length)]; means.push(total / values.length); }
  means.sort((a, b) => a - b);
  const quantile = (p: number) => { const x = (means.length - 1) * p, i = Math.floor(x); return means[i] + (means[Math.min(i + 1, means.length - 1)] - means[i]) * (x - i); };
  return [quantile(.025), quantile(.975)];
}
export function inference(cycles: Cycle[], includeEstimatedRisk = false, minimum = 20, band = 0) {
  const known = cycles.filter(c => c.netVND !== undefined), risk = validRiskTrades(cycles, includeEstimatedRisk);
  const values = (risk.length ? risk.map(c => finiteNumber(rMultiple(c)!)) : known.map(c => finiteNumber(c.netVND!)));
  const ci = bootstrapMean(values), n = values.length;
  return { n, of: cycles.length, unit: risk.length ? 'R' : 'VNĐ', mean: n ? values.reduce((a, b) => a + b, 0) / n : null,
    ci, winCI: wilson(known.filter(c => finiteNumber(c.netVND!) > band).length, known.length), winN: known.length,
    edgeState: n < minimum ? 'insufficient' : !ci || ci[0] <= 0 && ci[1] >= 0 ? 'inconclusive' : ci[0] > 0 ? 'positive-signal' : 'negative-signal' };
}
