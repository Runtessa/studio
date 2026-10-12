import { useRef } from 'react';
import { FILE_ACCEPT } from '@/lib/assistant/attachment-types';
import { AttachmentCards } from './AttachmentCards';
import type { PendingAttachment } from './useAttachments';
import { FiPaperclip, FiEdit3, FiSend, FiSettings, FiSquare, FiTrash2 } from 'react-icons/fi';

type ChatFooterProps = {
  ready?: boolean;
  attachments?: PendingAttachment[];
  uploading?: boolean;
  capturing?: boolean;
  onFiles?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  onAnnotatePreview?: () => void;
  activeMainTab: 'chats' | 'runs';
  input: string;
  sending: boolean;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
  onClearChat: () => void;
  onOpenChat: () => void;
  readOnly?: boolean;
  onReadOnlyChange?: (value: boolean) => void;
};

export function ChatFooter({
  ready = true,
  attachments = [],
  uploading = false,
  capturing = false,
  onFiles,
  onRemoveAttachment,
  onAnnotatePreview,
  activeMainTab,
  input,
  sending,
  setInput,
  onSend,
  onStop,
  onOpenSettings,
  onClearChat,
  onOpenChat,
  readOnly,
  onReadOnlyChange,
}: ChatFooterProps) {
  const picker = useRef<HTMLInputElement>(null);
  const busy = sending || uploading || capturing;
  if (activeMainTab === 'chats') {
    return (
      <div className="border-t border-[#2a2d2e] p-3" onDragOver={event => { if (!busy && event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); if (!busy) onFiles?.(Array.from(event.dataTransfer.files)); } }}>
        <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="hidden" aria-label="Attach files" disabled={busy || !ready}
          onChange={event => { if (event.target.files) onFiles?.(Array.from(event.target.files)); event.target.value = ''; }} />
        <div className="mb-2"><AttachmentCards files={attachments} onRemove={onRemoveAttachment} disabled={busy} /></div>
        {uploading || capturing ? <p role="status" className="mb-2 text-[11px] text-gray-400">{uploading ? 'Uploading attachments…' : 'Capturing preview…'}</p> : null}
        <textarea
          value={input}
          onPaste={event => { const files = Array.from(event.clipboardData.items).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter((file): file is File => Boolean(file)); if (files.length) { event.preventDefault(); if (!busy) onFiles?.(files); } }}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (sending) {
                onStop();
              } else {
                if (ready && !uploading && !capturing) onSend();
              }
            }
          }}
          placeholder="Describe what you need (modules, UI, ACL, shared files)…"
          className="h-20 w-full resize-none rounded-lg border border-[#2a2d2e] bg-[#1b1b1b] px-3 py-2 text-[12px] text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0b5b96]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || !ready || attachments.length >= 5} onClick={() => picker.current?.click()} aria-label="Attach file or image" title="Attach file or image" className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2d2e] text-gray-200 hover:bg-[#2a2d2e] disabled:opacity-40"><FiPaperclip /></button>
          <button type="button" disabled={busy || !ready || attachments.length >= 5} onClick={onAnnotatePreview} aria-label="Annotate preview" title="Annotate preview" className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2d2e] text-gray-200 hover:bg-[#2a2d2e] disabled:opacity-40"><FiEdit3 /></button>
          <label className="flex items-center gap-1 text-[11px] text-gray-300">
            <input
              type="checkbox"
              checked={Boolean(readOnly)}
              disabled={sending}
              onChange={(event) => onReadOnlyChange?.(event.target.checked)}
            />
            Read-only
          </label>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2d2e] text-gray-200 hover:bg-[#2a2d2e]"
            onClick={onOpenSettings}
            aria-label="Assistant settings"
            title="Assistant settings"
          >
            <FiSettings />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2d2e] text-gray-200 hover:bg-[#2a2d2e]"
            onClick={onClearChat}
            aria-label="Clear chat"
            title="Clear chat"
          >
            <FiTrash2 />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!sending && (!ready || uploading || capturing || (!input.trim() && !attachments.length))}
              className="flex items-center gap-2 rounded bg-[#0b5b96] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#0f72be] disabled:opacity-60"
              onClick={() => {
                if (sending) {
                  onStop();
                } else {
                  onSend();
                }
              }}
            >
              {sending ? 'Stop' : 'Send'}
              {sending ? <FiSquare className="h-4 w-4" /> : <FiSend className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-gray-500">Images ≤5 MB · Code and text ≤256 KB · 5 files · Downloads expire after 7 days</p>
      </div>
    );
  }

  return (
    <div className="border-t border-[#2a2d2e] p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2d2e] text-gray-200 hover:bg-[#2a2d2e]"
          onClick={onOpenSettings}
          aria-label="Assistant settings"
          title="Assistant settings"
        >
          <FiSettings />
        </button>
        <button
          type="button"
          className="rounded border border-[#2a2d2e] px-3 py-2 text-[12px] text-gray-200 hover:bg-[#2a2d2e]"
          onClick={onOpenChat}
        >
          Open chat
        </button>
      </div>
    </div>
  );
}
