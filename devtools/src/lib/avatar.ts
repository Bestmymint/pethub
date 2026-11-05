import 'server-only';

import { createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

export const MAX_AVATAR_UPLOAD = 5 * 1024 * 1024;
const prefix = 'data:image/webp;base64,';
const maxOutput = 128 * 1024;

export function avatarUrl(user: { id: string; image: string | null }) {
  if (!user.image?.startsWith(prefix)) return null;
  const version = createHash('sha256').update(user.image).digest('hex').slice(0, 16);
  return `/api/avatars/${encodeURIComponent(user.id)}?v=${version}`;
}

export function avatarBytes(image: string | null) {
  if (!image?.startsWith(prefix) || image.length > maxOutput * 1.4 + prefix.length) return null;
  const encoded = image.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return null;
  return Buffer.from(encoded, 'base64');
}

export async function normalizeAvatar(file: File) {
  if (!file.size || file.size > MAX_AVATAR_UPLOAD) throw new Error('FILE_TOO_LARGE');
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = await fileTypeFromBuffer(bytes);
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime))
    throw new Error('INVALID_IMAGE');
  try {
    const output = await sharp(bytes, { limitInputPixels: 20_000_000, animated: false })
      .rotate()
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    if (output.length > maxOutput) throw new Error('INVALID_IMAGE');
    return prefix + output.toString('base64');
  } catch {
    throw new Error('INVALID_IMAGE');
  }
}
