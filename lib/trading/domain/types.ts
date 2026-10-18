import { z } from 'zod';

export const decSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
export type Dec = string;
export type Ccy = string;
export const utcSchema = z.string().datetime({ offset: true });
export const platformSchema = z.enum(['VN_STOCK', 'MT5', 'BINANCE', 'GENERIC', 'MANUAL']);
export const marketSchema = z.enum(['stock', 'crypto', 'forex', 'commodity']);
export type SourcePlatform = z.infer<typeof platformSchema>;
export type MarketType = z.infer<typeof marketSchema>;
export type Granularity = 'fill' | 'position' | 'closing-order' | 'day-symbol';
export const costSchema = z.object({
  kind: z.enum(['commission', 'tax', 'funding', 'swap', 'interest', 'other']),
  amount: decSchema.optional(), ccy: z.string().min(1),
  origin: z.enum(['reported', 'derived', 'missing']),
  rateToVND: decSchema.optional(), batchId: z.string().optional(), sourceId: z.string().optional(),
}).superRefine((c, ctx) => {
  if ((c.origin === 'missing') !== (c.amount === undefined)) ctx.addIssue({ code: 'custom', message: 'Missing cost must have no amount; known cost requires amount' });
});
export type CostItem = z.infer<typeof costSchema>;
export const accountSchema = z.object({
  accountId: z.string().min(1), accountKey: z.string().min(1), label: z.string(),
  platform: platformSchema, market: marketSchema, baseCcy: z.string().min(1),
  costBasis: z.enum(['fifo', 'average']), allowsShort: z.boolean(), bookMode: z.enum(['netting', 'hedging']),
  sourceTimezone: z.string(), pnlModel: z.enum(['linear', 'reported']), contractMultiplier: decSchema,
  quoteCcy: z.string().min(1),
  openingBalances: z.array(z.object({ symbol: z.string(), qty: decSchema, avgPrice: decSchema,
    asOfUtc: utcSchema, origin: z.literal('user-declared'), positionSide: z.enum(['LONG', 'SHORT']).optional(),
    lots: z.array(z.object({ qty: decSchema, price: decSchema })).optional(),
    rateToVND: decSchema.optional(),
  })),
  feePreset: z.object({ buyRate: decSchema.optional(), sellRate: decSchema.optional(), taxSellRate: decSchema.optional(), minFee: decSchema.optional() }).optional(),
});
export type Account = z.infer<typeof accountSchema>;
const base = {
  fillId: z.string().min(1), batchId: z.string().min(1), accountId: z.string().min(1), bookKey: z.string().min(1),
  symbol: z.string().min(1), rootSymbol: z.string().min(1), nativeId: z.string().optional(),
  positionId: z.string().optional(), positionSide: z.enum(['LONG', 'SHORT']).optional(),
  dedupeKey: z.string(), dedupeOcc: z.number().int().positive(), normVersion: z.number().int().positive(), active: z.boolean(),
  synthetic: z.enum(['manual', 'legacy-migration', 'opening-balance']).optional(), raw: z.record(z.string(), z.string()),
};
export const fillSchema = z.discriminatedUnion('role', [
  z.object({ ...base, role: z.literal('fill'), tsUtc: utcSchema, seq: z.string().regex(/^\d+$/).optional(),
    side: z.enum(['buy', 'sell']), qty: decSchema, price: decSchema, costs: z.array(costSchema),
    adjustment: z.object({ quantityFactor: decSchema, basisDelta: decSchema, reason: z.string().min(1) }).optional(),
    reportedRealized: z.object({ gross: decSchema.optional(), net: decSchema.optional(), ccy: z.string() }).optional(),
  }),
  z.object({ ...base, role: z.literal('reported-position'), openTsUtc: utcSchema, closeTsUtc: utcSchema,
    direction: z.enum(['LONG', 'SHORT']), qty: decSchema, openPrice: decSchema, closePrice: decSchema,
    reportedGross: decSchema.optional(), reportedNet: decSchema.optional(), ccy: z.string(), costs: z.array(costSchema),
    stopLossPrice: decSchema.optional(), stopOrigin: z.enum(['confirmed-initial', 'reported-current', 'unknown']), takeProfitPrice: decSchema.optional(),
  }),
  z.object({ ...base, role: z.literal('reported-close'), closeTsUtc: utcSchema, qty: decSchema, avgCostPrice: decSchema,
    closePrice: decSchema, reportedGross: decSchema.optional(), reportedNet: decSchema.optional(), ccy: z.string(), costs: z.array(costSchema),
    granularity: z.enum(['closing-order', 'day-symbol']),
  }),
]);
export type Fill = z.infer<typeof fillSchema>;
export type TradeFill = Extract<Fill, { role: 'fill' }>;
export const cashSchema = z.object({
  eventId: z.string(), batchId: z.string(), accountId: z.string(), active: z.boolean(), tsUtc: utcSchema,
  kind: z.enum(['funding', 'swap', 'interest', 'commission', 'deposit', 'withdrawal', 'other', 'reported-realized']),
  symbol: z.string().optional(), positionId: z.string().optional(), amount: decSchema, ccy: z.string(),
  nativeId: z.string().optional(), dedupeKey: z.string(), dedupeOcc: z.number().int().positive(),
  normVersion: z.number().int().positive(),
  // Explicit reconciliation linkage: this cash row must not be counted again.
  reconcilesFillId: z.string().optional(), raw: z.record(z.string(), z.string()),
});
export type CashEvent = z.infer<typeof cashSchema>;
export type ImportWarning = { code: string; severity: 'blocker' | 'needs-confirmation' | 'info'; message: string; rowRefs?: number[]; fillIds?: string[] };
export const parseConfigSchema = z.object({
  templateFingerprint: z.string(), platform: platformSchema, reportType: z.string(),
  granularity: z.enum(['fill', 'position', 'closing-order', 'day-symbol']), columnMapping: z.record(z.string(), z.string()),
  decimalSeparator: z.enum([',', '.']), thousandSeparator: z.enum([',', '.', ' ', '']), sourceTimezone: z.string(),
  priceUnit: z.object({ multiplierToCcy: decSchema, confirmedBy: z.enum(['report', 'template', 'user']), crossCheck: z.enum(['passed', 'failed', 'n/a']) }),
  qtyUnit: z.object({ multiplier: decSchema }).optional(), contractMultiplier: decSchema.optional(),
  pnlBasis: z.enum(['gross', 'net', 'unknown']), costCompleteness: z.enum(['complete', 'partial', 'unknown']), openingPositionsConfirmed: z.boolean(),
});
export type ParseConfig = z.infer<typeof parseConfigSchema>;
export const batchSchema = z.object({
  batchId: z.string().min(1), accountId: z.string(), status: z.enum(['staged', 'committed', 'rolled-back']),
  connector: z.string(), reportType: z.enum(['fills', 'closedPositions', 'cashEvents', 'mixed']),
  fileSha256: z.string().optional(), fileName: z.string().optional(), parseConfig: parseConfigSchema,
  adapterVersion: z.string(), normVersion: z.number().int().positive(),
  counts: z.object({ rows: z.number().int().nonnegative(), newEntries: z.number().int().nonnegative(), duplicates: z.number().int().nonnegative(), conflicts: z.number().int().nonnegative(), errors: z.number().int().nonnegative() }),
  warnings: z.array(z.object({ code: z.string(), severity: z.enum(['blocker', 'needs-confirmation', 'info']), message: z.string(), rowRefs: z.array(z.number()).optional(), fillIds: z.array(z.string()).optional() })),
  fx: z.array(z.object({ ccy: z.string(), rateToVND: decSchema, source: z.enum(['user', 'default']) })),
  fixedRiskVND: decSchema.optional(), idempotencyKey: z.string(), ledgerVersionAtStage: z.number().int().nonnegative(),
  createdAt: utcSchema, committedAt: utcSchema.optional(), rolledBackAt: utcSchema.optional(),
});
export type ImportBatch = z.infer<typeof batchSchema>;
export const overlaySchema = z.object({
  overlayId: z.string(), anchorFillIds: z.array(z.string()).min(1), state: z.enum(['attached', 'detached', 'needs-attention']),
  attachedTradeId: z.string().optional(), setupTag: z.string().optional(), mistakeTags: z.array(z.string()), notes: z.string().optional(),
  checklist: z.record(z.string(), z.boolean()).optional(), stopLossPrice: decSchema.optional(),
  stopOrigin: z.enum(['confirmed-initial', 'reported-current', 'unknown']).optional(), riskOverrideVND: decSchema.optional(),
  reviewStatus: z.enum(['needs-review', 'reviewed']), disciplineScore: z.number().min(0).max(100).optional(), updatedAt: utcSchema,
}).superRefine((o, ctx) => {
  if ((o.reviewStatus === 'reviewed') !== (o.disciplineScore !== undefined)) ctx.addIssue({ code: 'custom', message: 'Only reviewed trades have a discipline score' });
});
export type TradeOverlay = z.infer<typeof overlaySchema>;
export type Risk = { amountVND?: Dec; origin: 'initial-stop' | 'user-entered' | 'batch-fixed' | 'none'; method?: 'linear-model' | 'implied-from-pnl' };
export interface Cycle {
  orderKey?: string;
  adjustments?: { fillId: string; tsUtc: string; afterLegCount: number; quantityFactor: Dec; basisDelta: Dec; reason: string }[];
  tradeId: string; accountId: string; bookKey: string; symbol: string; rootSymbol: string; market: MarketType; platform: SourcePlatform;
  direction: 'LONG' | 'SHORT'; status: 'closed' | 'open' | 'incomplete'; granularity: Granularity;
  openTsUtc?: string; closeTsUtc?: string; holdMinutes?: number; qtyOpened: Dec; avgEntry: Dec; avgExit?: Dec;
  legs: { fillId: string; role: 'open' | 'close'; qty: Dec; price: Dec; tsUtc: string }[];
  grossSource: 'computed' | 'reported'; gross?: Dec; costs: CostItem[]; net?: Dec; ccy: Ccy;
  grossVND?: Dec; netVND?: Dec; pnlBasis: 'gross' | 'net' | 'unknown'; costCompleteness: 'complete' | 'partial' | 'unknown';
  reconciliation: 'reconciled' | 'mismatch' | 'unverifiable'; risk: Risk;
  sourceFillIds: string[]; sourceBatchIds: string[]; anomalies: string[]; shadowed?: boolean;
  overlay?: TradeOverlay;
}
export type UnifiedTrade = Cycle;
export interface RealizedEvent {
  orderKey?: string;
  market?: MarketType; platform?: SourcePlatform;
  eventId: string; tradeId?: string; fillId: string; accountId: string; symbol?: string; batchId: string; tsUtc: string;
  qtyClosed: Dec; gross?: Dec; costs: CostItem[]; net?: Dec; ccy: Ccy; fx?: { rateToVND: Dec };
  grossVND?: Dec; netVND?: Dec; costCompleteness: 'complete' | 'partial' | 'unknown'; shadowed?: boolean;
  kind: 'close' | 'cash';
}
export interface OpenLot { fillId: string; tradeId: string; bookKey: string; symbol: string; direction: 'LONG' | 'SHORT'; qty: Dec; price: Dec; basis: Dec; costs: CostItem[] }
export interface ReplayResult { cycles: Cycle[]; events: RealizedEvent[]; openPositions: OpenLot[]; anomalies: ImportWarning[] }
export type MetricResult<T> = { status: 'ok'; value: T; n: number; of: number } | { status: 'no-data' | 'undefined'; reason: string; n: number; of: number } | { status: 'no-losses'; n: number; of: number };
export const snapshotSchema = z.object({
  accounts: z.array(accountSchema), batches: z.array(batchSchema), fills: z.array(fillSchema), cashEvents: z.array(cashSchema),
  overlays: z.array(overlaySchema), settings: z.record(z.string(), z.unknown()),
});
export type LedgerSnapshot = z.infer<typeof snapshotSchema>;
