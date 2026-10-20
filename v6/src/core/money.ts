import Decimal from 'decimal.js';
import type { Dec } from '../data/schema';
export const DecimalValue = Decimal.clone({
  precision: 60,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1000,
  toExpPos: 1000,
});
export function D(value: Dec) {
  if (
    typeof value !== 'string' ||
    value.length > 256 ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
  )
    throw Error('INVALID_DECIMAL');
  return new DecimalValue(value);
}
export const dec = (value: Decimal): Dec => (value.isZero() ? '0' : value.toFixed());
export const sum = (values: Dec[]) => dec(values.reduce((s, v) => s.plus(D(v)), D('0')));
export const ratio = (a: Dec, b: Dec): Dec | undefined =>
  D(b).isZero() ? undefined : dec(D(a).div(D(b)));
export const number = (value: Dec) => {
  const n = D(value).toNumber();
  if (!Number.isFinite(n)) throw Error('DISPLAY_RANGE');
  return n;
};
