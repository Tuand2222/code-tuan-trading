import Papa from 'papaparse';
import { SSF } from 'xlsx';
import { type SheetSample } from './tableReader';
export function tableCSV(table: SheetSample) {
  return Papa.unparse({
    fields: table.headers,
    data: table.rows.map((row) =>
      table.headers.map((h) => {
        const value = row.values[h] ?? '';
        if (
          row.numericCells?.includes(h) &&
          /^(time|date|dateutc|timestamp|thoigian|ngaykhop)$/i.test(h.replace(/[^a-z]/gi, ''))
        ) {
          const d = SSF.parse_date_code(Number(value), { date1904: row.dateSystem === 1904 });
          if (!d) throw Error('Ngày Excel không hợp lệ tại dòng ' + row.row);
          return new Date(
            Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S, Math.round(d.u * 1000)),
          ).toISOString();
        }
        return value;
      }),
    ),
  });
}
