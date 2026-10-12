import sharp from 'sharp';
import { MAX_IMAGE_BYTES, MAX_TEXT_BYTES, type PreviewAnnotation } from './attachment-types';

export function attachmentError(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}
export function normalizePreview(value: unknown): PreviewAnnotation | undefined {
  if (value == null) return undefined;
  const data = value as PreviewAnnotation;
  if (typeof data.route !== 'string' || !data.route.startsWith('/') || data.route.length > 1000 ||
      !['draft', 'published'].includes(data.stage) || !Number.isInteger(data.width) ||
      !Number.isInteger(data.height) || data.width < 1 || data.height < 1 ||
      data.width > 8192 || data.height > 8192 || !Array.isArray(data.marks) ||
      !data.marks.length || data.marks.length > 20) attachmentError('Invalid preview annotation');
  const marks = data.marks.map(mark => {
    const { x, y, width, height, note } = mark ?? {};
    if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 ||
        x + width > 1.001 || y + height > 1.001 || typeof note !== 'string' || !note.trim() || note.length > 1000)
      attachmentError('Every preview region needs a valid position and a note');
    return { x, y, width, height, note: note.trim() };
  });
  return { route: data.route, stage: data.stage, width: data.width, height: data.height, marks };
}

export async function validateAttachment(raw: unknown) {
  const data = raw as { name?: unknown; base64?: unknown; preview?: unknown };
  if (!data || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200 ||
      /[\x00-\x1f/\\]/.test(data.name)) attachmentError('Invalid file name');
  if (typeof data.base64 !== 'string' || data.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4)
    attachmentError('Files must be at most 5 MB', 413);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.base64))
    attachmentError('Invalid file encoding');
  const bytes = Buffer.from(data.base64, 'base64');
  if (!bytes.length) attachmentError('Empty files cannot be attached');
  const extension = data.name.split('.').pop()?.toLowerCase() || '';
  const imageMime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  if (imageMime[extension]) {
    let meta;
    try { meta = await sharp(bytes, { limitInputPixels: 24_000_000 }).metadata(); }
    catch { attachmentError('This image could not be read. Use PNG, JPEG or WebP.'); }
    if (!meta.width || !meta.height || meta.width > 8192 || meta.height > 8192 ||
        meta.width * meta.height > 24_000_000 || !['png', 'jpeg', 'webp'].includes(meta.format || '') ||
        imageMime[extension] !== `image/${meta.format}` || (meta.pages || 1) > 1)
      attachmentError('Use a still PNG, JPEG or WebP image up to 8192 pixels per side');
    const preview = normalizePreview(data.preview);
    if (preview && (preview.width !== meta.width || preview.height !== meta.height))
      attachmentError('The preview dimensions do not match the image');
    return { name: data.name, kind: 'image' as const, mime: imageMime[extension], size: bytes.length,
      base64: data.base64, ...(preview ? { preview } : {}) };
  }
  if (!/^(txt|md|csv|json|js|jsx|ts|tsx|css|html|xml|yaml|yml|toml|ini|sql|py|go|cs|rs|c|h|sh|log|svg|env|gitignore)$/.test(extension))
    attachmentError('Supported files: PNG, JPEG, WebP, code and UTF-8 text');
  if (bytes.length > MAX_TEXT_BYTES) attachmentError('Text and code files must be at most 256 KB', 413);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { attachmentError('Text files must use UTF-8 encoding'); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) attachmentError('Binary files are not supported');
  if (data.preview != null) attachmentError('Preview annotations require an image');
  return { name: data.name, kind: 'text' as const, mime: 'text/plain', size: bytes.length, base64: data.base64 };
}
