import { z } from 'zod';
import { DEFAULT_RISK, dayInZone, type RiskSettings } from '../../../lib/risk-analytics';
import type { Journal, CashFlow } from './schema';
const pct = z.number().finite().min(0).max(100);
export const capitalPolicySchema = z
  .object({
    riskPercent: pct.default(1),
    dailyLossPercent: pct.default(3),
    defensivePercent: pct.default(5),
    stopPercent: pct.default(15),
    maxDrawdownPercent: pct.default(20),
    floorMode: z.enum(['static', 'trailing']).default('static'),
    disciplineLock: z.boolean().default(false),
  })
  .refine(
    (p) => p.defensivePercent < p.stopPercent && p.stopPercent <= p.maxDrawdownPercent,
    'Ngưỡng phòng thủ phải nhỏ hơn ngưỡng dừng và không vượt giới hạn sụt giảm.',
  );
export function journalCapitalSettings(j: Journal, flows: CashFlow[]): RiskSettings {
  return {
    ...DEFAULT_RISK,
    ...j.settings.capitalPolicy,
    initialCapital: Number(j.startingBalance ?? 0),
    timezone: j.timezone,
    cashFlows: flows
      .filter((f) => f.journalId === j.id)
      .map((f) => ({
        id: f.id,
        date: dayInZone(new Date(f.date), j.timezone),
        type: f.type,
        amount: Number(f.amount),
      })),
  };
}
export const capitalLabSchema = z.object({
  source: z.enum(['v6', 'classic']).default('v6'),
  candidateSetup: z.string().max(256).default(''),
  omegaThreshold: z.number().finite().min(-100).max(100).default(0),
  alpha: z.number().min(0.01).max(0.99).default(0.8),
  beta: z.number().min(0.0001).max(0.99).default(0.05),
  probabilityBox: z.number().min(0).max(0.95).default(0),
  model: z.enum(['empirical', 'binary']).default('empirical'),
  winRate: z.number().min(0.001).max(0.999).default(0.55),
  payoff: z.number().positive().max(20).default(1.5),
  riskPercent: z.number().min(0).max(25).default(1),
  capital: z.number().positive().max(1e15).default(10000),
  paths: z.union([z.literal(1000), z.literal(10000)]).default(1000),
  steps: z.number().int().min(20).max(1000).default(250),
  seed: z.number().int().min(0).max(2147483647).default(2103),
  losingStreak: z.number().int().min(0).max(100).default(0),
  tailFactor: z.number().min(1).max(10).default(1),
  extraCostR: z.number().min(0).max(10).default(0),
  liquidityDays: z.number().min(10).max(120).default(10),
  lossBuffer: z.number().int().min(1).max(100).default(4),
  tradesPerDay: z.number().int().min(1).max(100).default(5),
  targetPercent: z.number().positive().max(100).default(10),
  minDays: z.number().int().min(0).max(100).default(0),
  dailyLimit: z.number().positive().max(50).default(3),
  totalLimit: z.number().positive().max(90).default(10),
  floorMode: z.enum(['static', 'trailing', 'trailing-locked']).default('static'),
  challengeFee: z.number().min(0).max(1e9).default(0),
  split: z.number().min(0).max(100).default(80),
  payoutDays: z.number().int().min(1).max(100).default(10),
});
export type CapitalLab = z.infer<typeof capitalLabSchema>;
export const defaultCapitalLab = () => capitalLabSchema.parse({});
export function readCapitalLab(journalId: string): CapitalLab {
  try {
    return capitalLabSchema.parse(
      JSON.parse(localStorage.getItem('tuan-v6-capital:' + journalId) ?? '{}'),
    );
  } catch {
    return defaultCapitalLab();
  }
}
