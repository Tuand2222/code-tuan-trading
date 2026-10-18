import type { Account, CashEvent, Fill, ImportBatch, LedgerSnapshot, TradeOverlay } from '../domain/types';
export interface CommitInput { batch: ImportBatch; fills: Fill[]; cashEvents: CashEvent[]; accounts?: Account[]; overlays?: TradeOverlay[]; confirmedWarnings?: string[] }
export interface CommitResult { version: number; newEntries: number; duplicates: number; batchId: string }
export interface LedgerStore {
  getLedgerVersion(): Promise<number>;
  listEntries(scope?: { bookKey?: string; active?: boolean; accountId?: string }): Promise<Fill[]>;
  snapshot(): Promise<{ version: number; data: LedgerSnapshot }>;
  commitBatch(input: CommitInput, expectedLedgerVersion: number): Promise<CommitResult>;
  rollbackBatch(batchId: string, expectedLedgerVersion: number): Promise<number>;
  saveOverlay(overlay: TradeOverlay, expectedLedgerVersion: number): Promise<number>;
  exportAll(): Promise<string>;
  importAll(json: string, expectedLedgerVersion: number): Promise<number>;
}
