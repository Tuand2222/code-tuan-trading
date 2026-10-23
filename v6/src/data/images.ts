import { z } from 'zod';
import { sha256 } from './backup';
const imageSchema = z
  .object({
    kind: z.literal('image'),
    mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    base64: z
      .string()
      .max(3 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export function imageDataURL(raw: string) {
  const value = imageSchema.parse(JSON.parse(raw));
  const bytes = atob(value.base64);
  if (
    !bytes.length ||
    (value.mime === 'image/png' && !value.base64.startsWith('iVBORw0KGgo')) ||
    (value.mime === 'image/jpeg' && !value.base64.startsWith('/9j/')) ||
    (value.mime === 'image/webp' && !(bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'))
  )
    throw Error('INVALID_IMAGE_BYTES');
  return 'data:' + value.mime + ';base64,' + value.base64;
}
export async function prepareImage(file: File) {
  if (file.size > 8 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw Error('IMAGE_TYPE_OR_SIZE');
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(image.width, image.height)),
    canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw Error('IMAGE_CANVAS_UNAVAILABLE');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    image.close();
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('IMAGE_ENCODE_FAILED'))),
      'image/webp',
      0.85,
    ),
  );
  if (blob.size > 2 * 1024 * 1024) throw Error('COMPRESSED_IMAGE_TOO_LARGE');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const raw = JSON.stringify({ kind: 'image', mime: blob.type, base64: btoa(binary) });
  imageDataURL(raw);
  return { id: 'image:' + (await sha256(raw)), raw, createdAt: new Date().toISOString() };
}
