import { D } from '../core/money';
import { formatInTimeZone } from 'date-fns-tz';
import type { Currency, Dec } from '../data/schema';
export type FormatKind = 'money' | 'percent' | 'R' | 'ratio' | 'count' | 'duration' | 'streak';
export function formatValue(
  value: Dec | null,
  kind: FormatKind,
  currency: Currency = 'VND',
  signed = false,
  holding: 'minutes' | 'hours' | 'days' = 'hours',
): string {
  if (value === null) return '—';
  let d = D(value);
  if (kind === 'duration') d = d.div(holding === 'hours' ? 60 : holding === 'days' ? 1440 : 1);
  const places =
    kind === 'money'
      ? currency === 'VND'
        ? 0
        : 2
      : kind === 'percent'
        ? 1
        : ['count', 'streak'].includes(kind)
          ? 0
          : 2;
  const rounded = d.toDecimalPlaces(places);
  const sign = rounded.lt(0) ? '−' : signed && rounded.gt(0) ? '+' : '';
  const [whole, fraction] = rounded.abs().toFixed(places).split('.');
  const english = kind === 'money' && currency !== 'VND';
  const number =
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, english ? ',' : '.') +
    (fraction ? (english ? '.' : ',') + fraction : '');
  if (kind === 'money')
    return (
      sign +
      (currency === 'USD' ? '$' : '') +
      number +
      (currency === 'VND' ? ' đ' : currency === 'USDT' ? ' USDT' : '')
    );
  if (kind === 'streak')
    return number + (d.isZero() ? ' lệnh' : d.gt(0) ? ' lệnh thắng' : ' lệnh thua');
  return (
    sign +
    number +
    (kind === 'R'
      ? 'R'
      : kind === 'percent'
        ? '%'
        : kind === 'duration'
          ? ' ' + { minutes: 'phút', hours: 'giờ', days: 'ngày' }[holding]
          : '')
  );
}
export const formatDate = (iso: string, zone = 'Asia/Ho_Chi_Minh') =>
  formatInTimeZone(new Date(iso), zone, 'dd/MM/yyyy HH:mm');
