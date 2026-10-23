import { z } from 'zod';
export const devicePreferenceSchema = z
  .object({
    key: z.enum(['tuan-trader-valuation-lab-v4', 'tuan-trader-system-range-v1']),
    value: z.string().max(2 * 1024 * 1024),
  })
  .strict();
export type DevicePreference = z.infer<typeof devicePreferenceSchema>;
export function readDevicePreferences(): DevicePreference[] {
  if (typeof localStorage === 'undefined') return [];
  return devicePreferenceSchema.shape.key.options.flatMap((key) => {
    const value = localStorage.getItem(key);
    return value === null ? [] : [{ key, value }];
  });
}
export function writeDevicePreferences(rows: DevicePreference[] = []) {
  if (typeof localStorage === 'undefined') return;
  for (const row of rows) localStorage.setItem(row.key, row.value);
}
