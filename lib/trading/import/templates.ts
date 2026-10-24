import { z } from 'zod';
import { parseConfigSchema } from '../domain/types';
const schema = z.object({ accountId: z.string(), connector: z.enum(['vn-stock-fills', 'vn-stock-realized-pl', 'mt5-positions', 'mt5-deals', 'binance-position-history', 'binance-trade-history', 'binance-transaction-history', 'generic-template']), config: parseConfigSchema, headers: z.array(z.string()).optional(), rate: z.string().optional(), fixedRisk: z.string().optional() });
export type ImportTemplate = z.infer<typeof schema>;
export function readImportTemplates(input: unknown): ImportTemplate[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap(item => { const parsed = schema.safeParse(item); return parsed.success ? [parsed.data] : []; });
}
