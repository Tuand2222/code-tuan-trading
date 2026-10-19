import { z } from 'zod';

// Persist original facts only. Gross/Net/R, averages, open quantity and holding
// duration belong to core/ in S1, never to these storage contracts.
export const decSchema = z
  .string()
  .max(256)
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
export type Dec = z.infer<typeof decSchema>;
const positive = decSchema.refine((v) => !v.startsWith('-') && /[1-9]/.test(v), 'Phải lớn hơn 0');
const nonnegative = decSchema.refine((v) => !v.startsWith('-'), 'Không được âm');
const id = z.string().trim().min(1).max(256);
const utc = z.iso.datetime();
const timezone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat('vi', { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, 'Múi giờ không hợp lệ');
export const marketSchema = z.enum([
  'stocks',
  'futures',
  'forex',
  'crypto',
  'commodities',
  'cfd',
  'options',
]);
export const currencySchema = z.enum(['VND', 'USD', 'USDT']);
export type Market = z.infer<typeof marketSchema>;
export type Currency = z.infer<typeof currencySchema>;

export const alertRuleSchema = z
  .object({
    id,
    kind: z.enum([
      'loss-over-r',
      'daily-loss',
      'daily-count',
      'drawdown',
      'loss-streak',
      'missing-data',
    ]),
    enabled: z.boolean(),
    threshold: positive,
    toleranceR: nonnegative.optional(),
    unit: z.enum(['R', 'money', 'percent', 'count', 'hours']),
    severity: z.enum(['info', 'warning', 'critical']),
  })
  .strict();
export type AlertRule = z.infer<typeof alertRuleSchema>;

export const journalSettingsSchema = z
  .object({
    minSample: z.number().int().min(1).default(20),
    holdingUnit: z.enum(['minutes', 'hours', 'days']).default('hours'),
    displayUnit: z.enum(['money', 'percent', 'R']).default('money'),
    lossToleranceR: nonnegative.default('0.10'),
    backupReminderDays: z.number().int().min(1).default(7),
  })
  .strict();
export type JournalSettings = z.infer<typeof journalSettingsSchema>;

export const journalSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(200),
    currency: currencySchema,
    timezone: timezone.default('Asia/Ho_Chi_Minh'),
    isDemo: z.boolean(),
    startingBalance: nonnegative.optional(),
    settings: journalSettingsSchema,
    createdAt: utc,
    archivedAt: utc.optional(),
    schemaVersion: z.literal(4),
  })
  .strict();
export type Journal = z.infer<typeof journalSchema>;

export const legSchema = z
  .object({
    id,
    kind: z.enum(['in', 'out']),
    time: utc,
    price: positive,
    quantity: positive,
    fee: nonnegative.optional(),
    synthetic: z.boolean().optional(),
  })
  .strict();
export type Leg = z.infer<typeof legSchema>;
export const attachmentSchema = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('blob'), blobKey: id, caption: z.string().max(2000) }).strict(),
  z
    .object({
      id,
      kind: z.literal('url'),
      url: z.url({ protocol: /^https?$/ }),
      caption: z.string().max(2000),
    })
    .strict(),
]);

export const tradeSchema = z
  .object({
    id,
    journalId: id,
    symbol: z.string().trim().min(1).max(80),
    market: marketSchema,
    side: z.enum(['long', 'short']),
    status: z.enum(['open', 'closed']),
    legs: z.array(legSchema).min(1),
    multiplier: positive.optional(),
    lotSize: positive.optional(),
    plannedSL: positive.optional(),
    plannedTP: positive.optional(),
    initialRisk: positive.optional(),
    // Cost convention: paid > 0, credits < 0 for funding/swap. Net subtracts costs.
    costs: z
      .object({
        commission: nonnegative,
        tax: nonnegative,
        funding: decSchema,
        swap: decSchema,
        other: nonnegative,
      })
      .strict(),
    costsKnown: z.boolean(),
    highestPrice: positive.optional(),
    lowestPrice: positive.optional(),
    otpHit: z.enum(['yes', 'no', 'breakeven']).optional(),
    setupId: id.optional(),
    errorTagIds: z.array(id),
    stageChips: z
      .object({ entry: z.array(id), management: z.array(id), exit: z.array(id) })
      .strict()
      .optional(),
    checklist: z.array(z.object({ criterionId: id, checked: z.boolean() }).strict()).optional(),
    disciplineLegacy: z.number().min(0).max(100).optional(),
    tags: z.array(id),
    emotion: z.string().max(200).optional(),
    starred: z.boolean(),
    review: z.object({ done: z.boolean(), at: utc.optional(), noteId: id.optional() }).strict(),
    attachments: z.array(attachmentSchema).max(6),
    customStats: z
      .record(z.string(), z.union([z.string(), z.number().finite()]))
      .refine((v) => Object.keys(v).length <= 20, 'Tối đa 20 thống kê'),
    importBatchId: id.optional(),
    mergedFrom: z.array(id).optional(),
    isDemo: z.boolean(),
    createdAt: utc,
    updatedAt: utc,
  })
  .strict()
  .superRefine((trade, ctx) => {
    if (!trade.legs.some((leg) => leg.kind === 'in'))
      ctx.addIssue({ code: 'custom', path: ['legs'], message: 'Cần ít nhất một khớp vào' });
    const ids = trade.legs.map((leg) => leg.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', path: ['legs'], message: 'ID khớp lệnh bị trùng' });
  });
export type Trade = z.infer<typeof tradeSchema>;

export const setupSchema = z
  .object({
    id,
    journalId: id,
    name: z.string().trim().min(1),
    checklist: z.array(
      z.object({ id, text: z.string().min(1), weight: z.number().positive() }).strict(),
    ),
    disabledAt: utc.optional(),
  })
  .strict();
export type Setup = z.infer<typeof setupSchema>;
export const errorTagSchema = z
  .object({
    id,
    journalId: id,
    code: id,
    name: z.string().min(1),
    stage: z.enum(['entry', 'management', 'exit']),
    tone: z.enum(['pos', 'neg', 'neu']),
    hotkey: z.number().int().min(1).max(9).optional(),
    disabledAt: utc.optional(),
  })
  .strict();
export type ErrorTag = z.infer<typeof errorTagSchema>;
export const planSchema = z
  .object({
    journalId: id,
    maxTradesPerDay: z.number().int().positive().optional(),
    maxLossPerDay: z
      .object({ type: z.enum(['R', 'money']), value: positive })
      .strict()
      .optional(),
    allowedSetupIds: z.array(id),
    sessionWindows: z.array(
      z.object({ from: z.iso.time({ precision: -1 }), to: z.iso.time({ precision: -1 }) }).strict(),
    ),
    alertRules: z.array(alertRuleSchema),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export const cashFlowSchema = z
  .object({
    id,
    journalId: id,
    date: utc,
    type: z.enum(['deposit', 'withdrawal']),
    amount: positive,
    note: z.string().optional(),
  })
  .strict();
export type CashFlow = z.infer<typeof cashFlowSchema>;
export const importBatchSchema = z
  .object({
    id,
    journalId: id,
    platform: id,
    fileName: z.string(),
    at: utc,
    tradeIds: z.array(id),
    stats: z
      .object({
        added: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        errors: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type ImportBatch = z.infer<typeof importBatchSchema>;
export const noteSchema = z
  .object({
    id,
    journalId: id,
    scope: z.enum(['trade', 'day', 'week', 'month']),
    refId: id,
    body: z.string(),
    templateId: id.optional(),
    createdAt: utc,
  })
  .strict();
export type Note = z.infer<typeof noteSchema>;
export const plannedTradeSchema = z
  .object({
    id,
    journalId: id,
    symbol: id,
    side: z.enum(['long', 'short']),
    plannedEntry: positive,
    plannedSL: positive,
    plannedTP: positive,
    setupId: id.optional(),
    status: z.enum(['planned', 'taken', 'missed', 'cancelled']),
    missedReason: z.string().optional(),
    takenTradeId: id.optional(),
  })
  .strict();
export type PlannedTrade = z.infer<typeof plannedTradeSchema>;
export const altStrategySchema = z
  .object({
    id,
    journalId: id,
    setupId: id,
    name: z.string().min(1),
    hypotheticalR: z.array(z.object({ tradeId: id, r: decSchema }).strict()),
  })
  .strict();
export type AltStrategy = z.infer<typeof altStrategySchema>;
export const customStatDefSchema = z
  .object({
    journalId: id,
    slot: z.number().int().min(1).max(20),
    name: z.string().min(1),
    kind: z.enum(['number', 'text', 'choice']),
    choices: z.array(z.string()).optional(),
    disabledAt: utc.optional(),
  })
  .strict();
export type CustomStatDef = z.infer<typeof customStatDefSchema>;
export const appMetaSchema = z
  .object({
    schemaVersion: z.literal(4),
    lastBackupAt: utc.optional(),
    lastOpenedAt: utc,
    thresholds: z.object({ minSample: z.number().int().positive().default(20) }).strict(),
  })
  .strict();
export type AppMeta = z.infer<typeof appMetaSchema>;
