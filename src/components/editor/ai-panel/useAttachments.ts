import { useEffect, useRef, useState } from 'react';
import { MAX_ATTACHMENTS, MAX_IMAGE_BYTES, MAX_TURN_BYTES, type AssistantAttachment, type PreviewMark } from '@/lib/assistant/attachment-types';
import type { ApiFetch } from './shared';
import { readFileBase64, renderAnnotatedPreview } from './attachmentFiles';
import type { PreviewSnapshot } from './capturePreview';
export type PendingAttachment = { attachment: AssistantAttachment; image?: string };

export function useAttachments(apiFetch: ApiFetch, scope: string, showError: (message: string) => void) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const generation = useRef(0), busy = useRef(false), records = useRef<PendingAttachment[]>([]);
  useEffect(() => { generation.current++; records.current = []; setPending([]); setUploading(false); busy.current = false;
    return () => { generation.current++; }; }, [scope, apiFetch]);
  const upload = async (name: string, base64: string, preview?: PreviewSnapshot & { marks: PreviewMark[] }) => {
    if (records.current.length >= MAX_ATTACHMENTS) throw new Error('Attach up to five files per message.');
    const size = base64.length * 3 / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    if (size + records.current.reduce((sum, item) => sum + item.attachment.size, 0) > MAX_TURN_BYTES)
      throw new Error('Attachments must total at most 10 MB per message.');
    const current = generation.current;
    const { image: _image, ...metadata } = preview ?? {};
    const result = await apiFetch('/api/assistant/attachments', { method: 'POST', body: { name, base64, ...(preview ? { preview: metadata } : {}) } });
    if (current !== generation.current) { void apiFetch(`/api/assistant/attachments/${result.attachment.id}`, { method: 'DELETE' }).catch(() => undefined); return; }
    const item = { attachment: result.attachment, ...(result.attachment.kind === 'image' ? { image: `data:${result.attachment.mime};base64,${base64}` } : {}) };
    records.current = [...records.current, item]; setPending(records.current);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    const current = generation.current; busy.current = true; setUploading(true);
    try { await action(); } catch (error) { if (current === generation.current) showError((error as Error).message); }
    finally { if (current === generation.current) { busy.current = false; setUploading(false); } }
  };
  const addFiles = (files: File[]) => run(async () => {
    const current = generation.current;
    for (const file of files) {
      if (current !== generation.current) return;
      if (file.size > MAX_IMAGE_BYTES) { showError(`${file.name}: files must be at most 5 MB.`); continue; }
      try {
        const base64 = await readFileBase64(file);
        if (current !== generation.current) return;
        await upload(file.name, base64);
      } catch (error) { if (current === generation.current) showError((error as Error).message); }
    }
  });
  const addPreview = async (snapshot: PreviewSnapshot, marks: PreviewMark[]) => {
    if (busy.current) throw new Error('Wait for attachments to finish uploading.');
    const current = generation.current;
    busy.current = true; setUploading(true);
    try {
      const base64 = await renderAnnotatedPreview(snapshot, marks);
      if (current !== generation.current) throw new Error('The chat changed. Capture the preview again.');
      await upload(`preview-${Date.now()}.png`, base64, { ...snapshot, marks });
    } finally { if (current === generation.current) { busy.current = false; setUploading(false); } }
  };
  const remove = (id: string) => {
    if (busy.current) return;
    records.current = records.current.filter(item => item.attachment.id !== id); setPending(records.current);
    void apiFetch(`/api/assistant/attachments/${id}`, { method: 'DELETE' }).catch(error => showError(error.message));
  };
  const consume = () => { records.current = []; setPending([]); };
  return { pending, uploading, addFiles, addPreview, remove, consume };
}
