import { Temporal } from '@js-temporal/polyfill';
export function parseTime(value: string, timezone: string, dateSystem: 1900 | 1904 = 1900): string {
  let s = value.trim();
  if (/^\d{4,6}(?:\.\d+)?$/.test(s)) {
    const serial = Number(s) + (dateSystem === 1904 ? 1462 : 0);
    if (serial < 61 || serial > 200000) throw new Error('INVALID_EXCEL_DATE');
    s = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000)).toISOString().slice(0, -1);
  }
  if (/^\d{4}[.]\d{2}[.]\d{2}/.test(s)) s = s.replace(/^(\d{4})[.](\d{2})[.](\d{2})/, '$1-$2-$3');
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) s = s.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/, (_, d: string, m: string, y: string) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  s = s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
  try {
    if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return new Date(Temporal.Instant.from(s).epochMilliseconds).toISOString();
    if (!timezone) throw new Error('TIMEZONE_REQUIRED');
    return new Date(Temporal.PlainDateTime.from(s).toZonedDateTime(timezone, { disambiguation: 'reject' }).epochMilliseconds).toISOString();
  } catch { throw new Error(`Ngày/múi giờ không hợp lệ hoặc giờ DST mơ hồ: ${value}`); }
}
