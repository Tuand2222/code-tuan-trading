import JSZip from 'jszip';
import type { Snapshot } from './snapshot';
import { imageDataURL } from './images';
import { encodeBackup } from './backup';
export async function chartbookZip(data: Snapshot, journalId: string, workspaceRaw?: string) {
  const zip = new JSZip();
  // Full workspace backup retains journals, IDs and images; image paths are generated indices.
  zip.file('ledger.json', await encodeBackup(data));
  if (workspaceRaw) zip.file('workspace.json', workspaceRaw);
  const links: string[] = [];
  for (const [i, trade] of data.trades.filter((t) => t.journalId === journalId).entries())
    for (const [j, a] of trade.attachments.entries()) {
      if (a.kind === 'url') links.push(trade.id + '\t' + a.url);
      else {
        const source = data.sources.find((s) => s.id === a.blobKey);
        if (!source) throw Error('BLOB_SOURCE_MISSING');
        const value = imageDataURL(source.raw);
        const ext = value.startsWith('data:image/png')
          ? 'png'
          : value.startsWith('data:image/jpeg')
            ? 'jpg'
            : 'webp';
        zip.file(`images/${i + 1}-${j + 1}.${ext}`, value.split(',')[1], { base64: true });
      }
    }
  zip.file('chart-links.txt', links.join('\n'));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
