import { useEffect, useState } from 'react';
import { FiDownload, FiFileText, FiX } from 'react-icons/fi';
import type { AssistantAttachment } from '@/lib/assistant/attachment-types';
import type { ApiFetch } from './shared';
import type { PendingAttachment } from './useAttachments';
import { AttachmentViewer } from './AttachmentViewer';

function AttachmentCard({ attachment, image: initialImage, apiFetch, onRemove, disabled }: PendingAttachment & {
  apiFetch?: ApiFetch; onRemove?: (id: string) => void; disabled?: boolean;
}) {
  const [image, setImage] = useState(initialImage || ''), [error, setError] = useState('');
  const [viewing, setViewing] = useState(false);
  const [fullImage, setFullImage] = useState(initialImage || ''), [opening, setOpening] = useState(false);
  useEffect(() => {
    let active = true;
    if (!image && attachment.kind === 'image' && apiFetch) void apiFetch(`/api/assistant/attachments/${attachment.id}?thumbnail=1`)
      .then(result => { if (active) setImage(result.previewImage); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [apiFetch, attachment.id, attachment.kind, attachment.mime, image]);
  const openImage = async () => {
    if (fullImage) { setViewing(true); return; }
    setOpening(true); setError('');
    try { const result = await apiFetch?.(`/api/assistant/attachments/${attachment.id}`);
      if (result) { setFullImage(`data:${attachment.mime};base64,${result.base64}`); setViewing(true); }
    } catch (err) { setError((err as Error).message); }
    finally { setOpening(false); }
  };
  const download = async () => {
    try {
      const result = await apiFetch?.(`/api/assistant/attachments/${attachment.id}`);
      if (!result) return;
      const bytes = Uint8Array.from(atob(result.base64), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: attachment.mime }));
      const link = document.createElement('a'); link.href = url; link.download = attachment.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError((err as Error).message); }
  };
  return <div className="min-w-0 rounded-lg border border-[#3c3c3c] bg-[#1f1f1f] p-2 text-[11px]">
    <div className="flex items-start gap-2">
      {image ? <button type="button" disabled={opening} aria-label={`View ${attachment.name}`} onClick={() => void openImage()} className="shrink-0 rounded hover:ring-1 hover:ring-[#007acc] disabled:opacity-40"><img src={image} alt={attachment.preview ? 'Annotated preview' : attachment.name} className="h-14 w-20 rounded object-contain" /></button> : <FiFileText className="mt-1 h-5 w-5 shrink-0 text-gray-400" />}
      <div className="min-w-0 flex-1"><div className="truncate text-gray-200" title={attachment.name}>{attachment.preview ? 'Annotated preview' : attachment.name}</div>
        <div className="mt-1 text-gray-500">{Math.max(1, Math.round(attachment.size / 1024))} KB{attachment.preview ? ` · ${attachment.preview.marks.length} region${attachment.preview.marks.length === 1 ? '' : 's'}` : ''}</div>
      </div>
      {onRemove ? <button disabled={disabled} type="button" onClick={() => onRemove(attachment.id)} aria-label={`Remove ${attachment.name}`} className="p-1 text-gray-400 hover:text-white disabled:opacity-40"><FiX /></button>
        : apiFetch ? <button type="button" onClick={() => void download()} aria-label={`Download ${attachment.name}`} className="p-1 text-gray-400 hover:text-white"><FiDownload /></button> : null}
    </div>
    {attachment.preview ? <details className="mt-1 text-gray-400"><summary className="cursor-pointer">Notes · {attachment.preview.route}</summary>
      <ol className="mt-1 list-decimal space-y-1 pl-4">{attachment.preview.marks.map((mark, i) => <li key={i} className="whitespace-pre-wrap break-words">{mark.note}</li>)}</ol></details> : null}
    {error ? <p role="alert" className="mt-1 text-amber-200">{error}</p> : null}
    {viewing ? <AttachmentViewer image={fullImage} attachment={attachment} onClose={() => { setViewing(false); if (!initialImage) setFullImage(''); }} /> : null}
  </div>;
}
export function AttachmentCards({ files, ...props }: { files: PendingAttachment[]; apiFetch?: ApiFetch; onRemove?: (id: string) => void; disabled?: boolean }) {
  return files.length ? <div className="grid w-full min-w-0 gap-2" aria-label="Attachments">{files.map(file => <AttachmentCard key={file.attachment.id} {...file} {...props} />)}</div> : null;
}
