import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import type { AssistantAttachment } from '@/lib/assistant/attachment-types';

export function AttachmentViewer({ image, attachment, onClose }: { image: string; attachment: AssistantAttachment; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; close.current?.focus(); return () => previous?.focus?.(); }, []);
  return createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onKeyDown={event => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); }
  }}>
    <div role="dialog" aria-modal="true" aria-label={attachment.preview ? 'Annotated preview image' : attachment.name} className="flex max-h-[94vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-lg border border-[#3c3c3c] bg-[#252526] text-gray-100">
      <div className="flex items-center justify-between gap-3 border-b border-[#3c3c3c] px-4 py-3"><span className="truncate text-sm">{attachment.preview ? 'Annotated preview' : attachment.name}</span><button ref={close} type="button" aria-label="Close attachment preview" onClick={onClose} className="p-2"><FiX /></button></div>
      <div className="min-h-0 overflow-auto p-3"><img src={image} alt={attachment.name} className="mx-auto block max-h-[70vh] max-w-full object-contain" />
        {attachment.preview ? <ol className="mx-auto mt-3 max-w-3xl list-decimal space-y-2 pl-5 text-[12px] text-gray-300">{attachment.preview.marks.map((mark, i) => <li key={i} className="whitespace-pre-wrap break-words">{mark.note}</li>)}</ol> : null}</div>
    </div>
  </div>, document.body);
}
