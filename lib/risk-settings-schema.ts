import {z} from 'zod';
import {DEFAULT_RISK} from './risk-analytics';
const amount = z.number().finite().min(0).max(1e15),
  percent = z.number().finite().min(0).max(100);
export const riskSettingsSchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3,8}$/).optional(),
    initialCapital: amount,
    riskPercent: percent,
    dailyLossPercent: percent,
    defensivePercent: percent,
    stopPercent: percent,
    maxDrawdownPercent: percent,
    floorMode: z.enum(["static", "trailing"]),
    accountMode: z.enum(["personal", "prop"]),
    unrealized: z.number().finite().nullable(),
    highWaterMark: amount.nullable(),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
    colorMode: z.enum(["standard", "accessible"]),
    recoveryReview: z.string().max(10000),
    recoveryPlan: z.string().max(10000),
    weeklyAutoPack: z.boolean().optional(),
    disciplineLock: z.boolean().optional(),
    exposures: z
      .array(
        z.object({
          id: z.string(),
          group: z.string(),
          side: z.string(),
          risk: amount,
        }),
      )
      .max(10000)
      .optional(),
    cashFlows: z
      .array(
        z.object({
          id: z.string(),
          date: z.string().date(),
          type: z.enum(["deposit", "withdrawal"]),
          amount: amount,
          origin: z.string().max(64).optional(),
          unifiedV6: z.record(z.string(),z.unknown()).optional(),
        }).passthrough(),
      )
      .max(100000)
      .optional(),
  })
  .strict();

export function normalizeRiskSettings(value:unknown) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid risk settings');
 return riskSettingsSchema.parse({...DEFAULT_RISK,...value});
}
