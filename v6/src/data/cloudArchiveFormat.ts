import { canonical, sha256 } from './backup';
export type ArchiveRecord = {
  collection: string;
  id: string;
  hash: string;
  deleted: boolean;
  value: unknown;
};
export async function parseCloudArchives(files: string[]) {
  const pages = files.map((raw) => {
    const lines = raw
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const header = lines.shift(),
      footer = lines.pop();
    if (
      header?.format !== 'tuan-cloud-archive' ||
      header.version !== 1 ||
      !footer ||
      typeof footer.complete !== 'boolean' ||
      footer.revision !== header.revision
    )
      throw Error('Tệp cloud thiếu phần đầu/cuối hoặc chưa tải hoàn chỉnh.');
    return { header, footer, records: lines as ArchiveRecord[] };
  });
  const records: ArchiveRecord[] = [],
    seen = new Set<string>();
  let cursor = '',
    revision: number | undefined,
    archiveId: string | undefined;
  while (pages.length) {
    const i = pages.findIndex((p) => p.header.after === cursor);
    if (i < 0) throw Error('Thiếu một gói sao lưu; chọn đủ tất cả các tệp.');
    const page = pages.splice(i, 1)[0];
    if (revision !== undefined && page.header.revision !== revision)
      throw Error('Các gói thuộc những phiên bản cloud khác nhau.');
    if (archiveId !== undefined && archiveId !== page.header.archiveId)
      throw Error('Các gói thuộc những kho khác nhau.');
    archiveId = page.header.archiveId;
    revision = page.header.revision;
    for (const r of page.records) {
      const key = r.collection + ':' + r.id;
      if (seen.has(key)) throw Error('Trùng mục trong bản sao');
      seen.add(key);
      if ((await sha256(canonical(r.deleted ? null : r.value))) !== r.hash)
        throw Error('Checksum bản sao không khớp');
      records.push(r);
    }
    if (page.footer.complete) {
      if (pages.length) throw Error('Có gói dữ liệu thừa hoặc khác bộ sao lưu.');
      return records;
    }
    if (typeof page.footer.next !== 'string' || page.footer.next === cursor)
      throw Error('Con trỏ gói không hợp lệ');
    cursor = page.footer.next;
  }
  throw Error('Chưa có gói cuối của bản sao.');
}
