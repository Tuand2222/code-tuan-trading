import { z } from 'zod';
export const devicePreferenceSchema = z
  .object({
    key: z
      .string()
      .refine(
        (k) =>
          ['tuan-trader-valuation-lab-v4', 'tuan-trader-system-range-v1'].includes(k) ||
          /^tuan-v6-quant:.{1,256}$/.test(k),
      ),
    value: z.string().max(2 * 1024 * 1024),
  })
  .strict();
export type DevicePreference = z.infer<typeof devicePreferenceSchema>;
export function readDevicePreferences(): DevicePreference[] {
  if (typeof localStorage === 'undefined') return [];
  const keys = ['tuan-trader-valuation-lab-v4', 'tuan-trader-system-range-v1'];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && /^tuan-v6-quant:.{1,256}$/.test(k)) keys.push(k);
  }
  return keys.flatMap((key) => {
    const value = localStorage.getItem(key);
    return value === null ? [] : [{ key, value }];
  });
}
export function writeDevicePreferences(rows: DevicePreference[] = []) {
  if (typeof localStorage === 'undefined') return;
  for (const row of rows) localStorage.setItem(row.key, row.value);
}
