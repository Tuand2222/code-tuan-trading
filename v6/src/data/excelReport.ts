import * as XLSX from 'xlsx';
import { tradeFacts } from '../core/trade';
import type { Snapshot } from './snapshot';

export function journalWorkbook(data: Snapshot, journalId: string) {
  const journal = data.journals.find((j) => j.id === journalId);
  if (!journal) throw Error('JOURNAL_NOT_FOUND');
  const trades = data.trades.filter((t) => t.journalId === journalId);
  const wb = XLSX.utils.book_new();
  const append = (name: string, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  append('So giao dich', [
    {
      Name: journal.name,
      Currency: journal.currency,
      Timezone: journal.timezone,
      DecimalConvention:
        'Số tiền/giá lưu dạng văn bản để giữ nguyên độ chính xác; ô trống là thiếu dữ liệu.',
    },
  ]);
  append(
    'Lenh',
    trades.map((t) => {
      const facts = tradeFacts(t);
      return {
        ID: t.id,
        Symbol: t.symbol,
        Side: t.side,
        Status: t.status,
        Gross: facts.gross,
        Cost: t.costsKnown ? facts.cost : null,
        Net: facts.net ?? null,
        Risk: facts.risk ?? null,
        R: facts.r ?? null,
        OpenedUTC: facts.openTime,
        ClosedUTC: facts.closeTime ?? null,
        Reviewed: t.review.done,
        Tags: t.tags.join(' | '),
      };
    }),
  );
  append(
    'Khop lenh',
    trades.flatMap((t) =>
      t.legs.map((l) => ({
        TradeID: t.id,
        LegID: l.id,
        Kind: l.kind,
        TimeUTC: l.time,
        Price: l.price,
        Quantity: l.quantity,
        Fee: l.fee ?? null,
      })),
    ),
  );
  append(
    'Ghi chu',
    data.notes
      .filter((n) => n.journalId === journalId)
      .map((n) => ({ Scope: n.scope, Reference: n.refId, Body: n.body, CreatedUTC: n.createdAt })),
  );
  append(
    'Dong tien',
    data.cashFlows
      .filter((c) => c.journalId === journalId)
      .map((c) => ({
        ID: c.id,
        DateUTC: c.date,
        Type: c.type,
        Amount: c.amount,
        Note: c.note ?? '',
      })),
  );
  return wb;
}
export function exportJournalExcel(data: Snapshot, journalId: string) {
  XLSX.writeFile(journalWorkbook(data, journalId), 'trading-journal.xlsx');
}
