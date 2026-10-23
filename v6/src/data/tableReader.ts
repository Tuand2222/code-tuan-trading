import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
export type SheetSample = {
  name: string;
  headers: string[];
  rows: {
    row: number;
    values: Record<string, string>;
    numericCells?: string[];
    dateSystem?: 1900 | 1904;
  }[];
};
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 200000;
export function headerKey(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
const knownHeaders = new Set([
  'symbol',
  'ma',
  'mack',
  'machungkhoan',
  'time',
  'date',
  'dateutc',
  'timestamp',
  'timestamputc',
  'thoigian',
  'ngaygiaodich',
  'ngayban',
  'ngaymua',
  'side',
  'type',
  'loailenh',
  'muaban',
  'position',
  'deal',
  'price',
  'gia',
  'quantity',
  'qty',
  'volume',
  'khoiluong',
  'klkhop',
  'giakhop',
  'ngaykhop',
  'giavon',
  'giaban',
  'lailo',
  'profit',
  'commission',
  'fee',
  'phi',
  'entryprice',
  'positionside',
  'opened',
  'closed',
  'closetime',
  'avgcloseprice',
  'closingpnl',
  'amount',
  'asset',
  'incometype',
  'feecurrency',
  'feecoin',
  'sourceid',
  'accountkey',
]);
const headerScore = (row: unknown[]) =>
  row.filter((v) => knownHeaders.has(headerKey(String(v ?? '')))).length;
function table(name: string, matrix: unknown[][]): SheetSample {
  const nonempty = matrix
    .map((r, i) => ({
      r: r.map((v) =>
        v === null || v === undefined
          ? ''
          : typeof v === 'number' && Number.isFinite(v)
            ? new Decimal(v).toFixed()
            : String(v).trim(),
      ),
      numeric: r.map((v, j) => (typeof v === 'number' ? j : -1)).filter((j) => j >= 0),
      i,
    }))
    .filter((x) => x.r.some(Boolean));
  // Export titles precede headers in broker spreadsheets. Keep physical row numbers.
  const scored = nonempty.map((x) => headerScore(x.r));
  const firstKnown = scored.findIndex((n) => n >= 3);
  const headerIndex =
    firstKnown >= 0 ? firstKnown : nonempty.findIndex((x) => x.r.filter(Boolean).length >= 3);
  if (headerIndex < 0) throw new Error('Không tìm thấy hàng tiêu đề (tối thiểu 3 cột).');
  const counts = new Map<string, number>();
  const headers = nonempty[headerIndex].r.map((h, i) => {
    const label = h.replace(/^\uFEFF/, '') || `Column ${i + 1}`;
    const n = (counts.get(label) ?? 0) + 1;
    counts.set(label, n);
    return n === 1 ? label : `${label}__${n}`;
  });
  const data = nonempty.slice(headerIndex + 1);
  if (data.length > MAX_ROWS) throw new Error('Vượt giới hạn 200.000 dòng.');
  if (data.some((x) => x.r.length > headers.length && x.r.slice(headers.length).some(Boolean)))
    throw new Error('Có dòng nhiều cột hơn tiêu đề; kiểm tra dấu phân cách.');
  return {
    name,
    headers,
    rows: data.map((x) => ({
      row: x.i + 1,
      values: Object.fromEntries(headers.map((h, i) => [h, x.r[i] ?? ''])),
      ...(x.numeric.length
        ? { numericCells: x.numeric.map((i) => headers[i]).filter(Boolean) }
        : {}),
    })),
  };
}
function splitSections(name: string, matrix: unknown[][], dateSystem: 1900 | 1904): SheetSample[] {
  const headers = matrix.map((row, i) => (headerScore(row) >= 3 ? i : -1)).filter((i) => i >= 0);
  if (!headers.length) return [table(name, matrix)];
  const sections: SheetSample[] = [];
  for (const [index, start] of headers.entries()) {
    let end = headers[index + 1] ?? matrix.length;
    const boundary = matrix.slice(start + 1, end).findIndex(
      (row) =>
        row.filter((v) => String(v ?? '').trim()).length <= 2 &&
        /^(positions|orders|deals|summary|results|closed transactions|open trades|total net profit|tong ket)\s*:?$/i.test(
          row
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join(' ')
            .replace(/:$/, ''),
        ),
    );
    if (boundary >= 0) end = start + 1 + boundary;
    const titleRow =
      start > 0 ? matrix[start - 1].map((v) => String(v ?? '').trim()).filter(Boolean) : [];
    const title = titleRow.length === 1 ? titleRow[0] : `Bảng ${index + 1}`;
    const section = table(
      headers.length === 1 ? name : `${name} · ${title}`,
      matrix.slice(start, end),
    );
    section.rows = section.rows.map((row) => ({ ...row, row: row.row + start, dateSystem }));
    sections.push(section);
  }
  return sections;
}
export function readTables(bytes: ArrayBuffer, filename: string): SheetSample[] {
  if (bytes.byteLength > MAX_BYTES) throw new Error('File vượt giới hạn 10 MB.');
  if (/\.(csv|tsv|txt)$/i.test(filename)) {
    const result = Papa.parse<string[]>(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
    });
    const errors = result.errors.filter((e) => e.code !== 'UndetectableDelimiter');
    if (errors.length) throw new Error(`CSV: ${errors[0].message}`);
    return [table(filename, result.data)];
  }
  if (!/\.(xlsx|xls|html|htm)$/i.test(filename))
    throw new Error('Chỉ nhận CSV, TSV, XLSX, XLS hoặc HTML.');
  // SheetJS reads cached cell values; it does not evaluate formulas or execute VBA.
  const wb = XLSX.read(bytes, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellDates: false,
    sheetRows: MAX_ROWS + 100,
    bookVBA: false,
  });
  return wb.SheetNames.flatMap((name) => {
    const sheet = wb.Sheets[name];
    const range = sheet['!fullref'] || sheet['!ref'];
    if (range && XLSX.utils.decode_range(range).e.r > MAX_ROWS + 98)
      throw new Error('Vượt giới hạn 200.000 dòng.');
    return splitSections(
      name,
      XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: '',
        blankrows: true,
      }),
      wb.Workbook?.WBProps?.date1904 ? 1904 : 1900,
    );
  });
}
export function errorCSV(
  errors: { row: number; message: string; values: Record<string, string> }[],
): string {
  const safe = (value: string) => (/^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value);
  return (
    '\uFEFF' +
    Papa.unparse(
      errors.map((e) =>
        Object.fromEntries(
          Object.entries({
            import_row: String(e.row),
            import_error: e.message,
            ...Object.fromEntries(Object.entries(e.values).map(([k, v]) => [`source:${k}`, v])),
          }).map(([k, v]) => [safe(k), safe(v)]),
        ),
      ),
    )
  );
}
