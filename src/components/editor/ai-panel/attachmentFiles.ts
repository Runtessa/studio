import type { PreviewMark } from '@/lib/assistant/attachment-types';
import type { PreviewSnapshot } from './capturePreview';

export function readFileBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read this file. Try attaching it again.'));
    reader.readAsDataURL(file);
  });
}
export function normalizedRegion(start: { x: number; y: number }, end: { x: number; y: number }, width: number, height: number) {
  let x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
  let w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
  if (w * width < 5 && h * height < 5) { w = Math.min(80 / width, 1); h = Math.min(48 / height, 1); x = start.x - w / 2; y = start.y - h / 2; }
  w = Math.min(1, Math.max(w, 6 / width)); h = Math.min(1, Math.max(h, 6 / height));
  return { x: Math.max(0, Math.min(x, 1 - w)), y: Math.max(0, Math.min(y, 1 - h)), width: w, height: h, note: '' };
}
export async function renderAnnotatedPreview(snapshot: PreviewSnapshot, marks: PreviewMark[]) {
  const image = new Image();
  image.src = snapshot.image;
  await image.decode();
  if (image.naturalWidth !== snapshot.width || image.naturalHeight !== snapshot.height) throw new Error('Preview dimensions changed. Capture it again.');
  const canvas = document.createElement('canvas');
  canvas.width = snapshot.width; canvas.height = snapshot.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the preview image.');
  ctx.drawImage(image, 0, 0);
  const lineWidth = Math.max(2, Math.round(snapshot.width / 500));
  marks.forEach((mark, index) => {
    const x = mark.x * canvas.width, y = mark.y * canvas.height, w = mark.width * canvas.width, h = mark.height * canvas.height;
    ctx.strokeStyle = '#007acc'; ctx.lineWidth = lineWidth;
    ctx.fillStyle = 'rgba(0,122,204,0.08)'; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#007acc'; ctx.fillRect(x, y, 25, 25);
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), x + 12.5, y + 13);
  });
  return canvas.toDataURL('image/png').split(',')[1];
}
