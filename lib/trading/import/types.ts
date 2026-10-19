import type { Account, CashEvent, Fill, Granularity, ImportWarning, ParseConfig, SourcePlatform } from '../domain/types';
export type RawRow = { row: number; values: Record<string, string>; numericCells?: string[]; dateSystem?: 1900 | 1904 };
export type SheetSample = { name: string; fileName?: string; fileSha256?: string; headers: string[]; rows: RawRow[] };
export type RowError = RawRow & { message: string };
export type ConnectorId = 'vn-stock-fills' | 'vn-stock-realized-pl' | 'mt5-positions' | 'mt5-deals' | 'binance-position-history' | 'binance-trade-history' | 'binance-transaction-history' | 'generic-template';
export type Detection = { connector: ConnectorId; platform: SourcePlatform; confidence: number; reportType: 'fills' | 'closedPositions' | 'cashEvents' | 'mixed'; granularity: Granularity; columnMapping: Record<string, string>; warnings: ImportWarning[] };
export type ParseContext = { config: ParseConfig; account: Account; batchId: string };
export type Parsed = { fills: Fill[]; cashEvents: CashEvent[]; errors: RowError[]; warnings: ImportWarning[] };
export interface SourceAdapter {
  id: ConnectorId; label: string; platform: SourcePlatform; version: string;
  declare: { pnlBasis: ParseConfig['pnlBasis']; costCompleteness: ParseConfig['costCompleteness']; costSigns: Record<string, 'positive-is-paid' | 'negative-is-paid'>; allowsShort: boolean; defaultTimezone?: string };
  fields: Record<string, string[]>; required: string[];
  detect(sample: SheetSample): Detection;
  parse(rows: RawRow[], context: ParseContext): Promise<Parsed>;
}
