import Decimal from 'decimal.js';
import type { CostItem, Dec } from './types';

// Never change Decimal's process-wide configuration (other consumers may use it).
export const DecimalValue = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN, toExpNeg: -1000, toExpPos: 1000 });
export function D(value: Dec): Decimal {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || value.length > 256) throw new Error('INVALID_DECIMAL');
  const result = new DecimalValue(value);
  if (!result.isFinite()) throw new Error('INVALID_DECIMAL');
  return result;
}
export function dec(value: Decimal): Dec { return value.isZero() ? '0' : value.toFixed(); }
export const sum = (values: Dec[]) => dec(values.reduce((a, b) => a.plus(D(b)), D('0')));
export function positive(value: Dec, name = 'amount'): Dec { if (!D(value).gt(0)) throw new Error(`INVALID_POSITIVE_${name}`); return dec(D(value)); }
export function parseDecimal(value: string, decimalSeparator: '.' | ',', thousandSeparator: '.' | ',' | ' ' | ''): Dec {
  if (decimalSeparator === thousandSeparator) throw new Error('AMBIGUOUS_SEPARATOR');
  const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const group = thousandSeparator ? `(?:\\d{1,3}(?:${escaped(thousandSeparator)}\\d{3})+|\\d+)` : '\\d+';
  if (!new RegExp(`^[+-]?${group}(?:${escaped(decimalSeparator)}\\d+)?$`).test(value.trim())) throw new Error('INVALID_NUMBER_FORMAT');
  const normalized = value.trim().split(thousandSeparator || '\0').join('').replace(decimalSeparator, '.');
  return dec(new DecimalValue(normalized));
}
export function splitCosts(costs: CostItem[], take: Dec, total: Dec): [CostItem[], CostItem[]] {
  positive(total); if (D(take).lt(0) || D(take).gt(D(total))) throw new Error('INVALID_ALLOCATION');
  const consumed: CostItem[] = [], remaining: CostItem[] = [];
  for (const cost of costs) {
    if (cost.amount === undefined) { consumed.push({ ...cost }); if (D(take).lt(D(total))) remaining.push({ ...cost }); continue; }
    const part = D(take).eq(D(total)) ? D(cost.amount) : D(cost.amount).mul(D(take)).div(D(total)).toDecimalPlaces(24);
    consumed.push({ ...cost, amount: dec(part) });
    if (D(take).lt(D(total))) remaining.push({ ...cost, amount: dec(D(cost.amount).minus(part)) });
  }
  return [consumed, remaining];
}
export function finiteNumber(value: Dec): number { const n = D(value).toNumber(); if (!Number.isFinite(n)) throw new Error('DISPLAY_RANGE_EXCEEDED'); return n; }
