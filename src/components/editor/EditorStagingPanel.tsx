import { useState } from 'react';
import type { StagingItem } from '@/components/editor/types';

type EditorStagingPanelProps = {
  stagingItems: StagingItem[];
  stagingCounts: { total: number; published: number };
  stagingPublishableCount: number;
  stagingBusy: boolean;
  stagingBusyId: string | null;
  onRequestPublish: (itemIds: string[], comment: string) => Promise<void>;
  formatTimestamp: (value: string) => string;
};

export function EditorStagingPanel({
  stagingItems,
  stagingCounts,
  stagingPublishableCount,
  stagingBusy,
  stagingBusyId,
  onRequestPublish,
  formatTimestamp,
}: EditorStagingPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === stagingItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stagingItems.map((item) => item.id)));
    }
  };

  const handleRequestPublish = async () => {
    if (selectedIds.size === 0 || !comment.trim()) return;
    await onRequestPublish(Array.from(selectedIds), comment);
    setSelectedIds(new Set());
    setComment('');
  };

  const canRequest = selectedIds.size > 0 && comment.trim().length > 0 && !stagingBusy;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[34px] items-center justify-between border-b border-[#2a2d2e] px-3 text-[11px] uppercase text-gray-400">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={stagingItems.length > 0 && selectedIds.size === stagingItems.length}
            onChange={selectAll}
            className="rounded border-gray-600 bg-gray-700 text-blue-600"
          />
          <span>Staging</span>
        </div>
        <div className="text-[10px] text-gray-500">
          {stagingCounts.published}/{stagingCounts.total} published
        </div>
      </div>
      
      <div className="flex flex-1 flex-col gap-2 overflow-auto p-2 text-[11px] text-gray-300">
        {stagingItems.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            No files available for staging.
          </div>
        ) : (
          stagingItems.map((item) => {
            const isPublished = Boolean(item.publishedVersion);
            const isDirty = Boolean(item.dirty);
            const isSelected = selectedIds.has(item.id);
            const kindLabel =
              item.kind === 'module' ? 'Module' : item.kind === 'ui' ? 'UI' : 'Shared';
            return (
              <div
                key={item.id}
                className={`rounded border p-2 cursor-pointer transition-colors ${
                  isSelected ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#2a2d2e] bg-[#1f1f1f]'
                }`}
                onClick={() => toggleSelect(item.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    className="mt-1 rounded border-gray-600 bg-gray-700 text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[12px] font-semibold text-gray-100">
                            {item.title}
                          </span>
                          <span className="rounded border border-[#2a2d2e] px-1.5 py-0.5 text-[9px] uppercase text-gray-400">
                            {kindLabel}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-400">
                          <span className="mr-2">Draft: {item.draftVersion || '—'}</span>
                          <span>Published: {item.publishedVersion || '—'}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isDirty && (
                          <span className="rounded bg-[#3b1f1f] px-1.5 py-0.5 text-[9px] text-red-200">
                            Unsaved
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] ${
                            isPublished
                              ? 'bg-emerald-900/40 text-emerald-300'
                              : 'bg-[#2a2d2e] text-gray-400'
                          }`}
                        >
                          {isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-[9px] text-gray-500">
                      {item.publishedAt
                        ? `Published ${formatTimestamp(item.publishedAt)}`
                        : 'Not published yet'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[#2a2d2e] bg-[#252526] p-3">
        <div className="mb-2 text-[10px] uppercase text-gray-500">Publish Comment</div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Describe your changes (e.g. why you are publishing)..."
          className="w-full rounded border border-[#3e3e42] bg-[#1e1e1e] p-2 text-[12px] text-gray-200 placeholder-gray-600 focus:border-[#007acc] focus:outline-none"
          rows={3}
        />
        <button
          type="button"
          className="mt-3 w-full rounded bg-[#0b5b96] py-2 text-[12px] font-semibold text-white hover:bg-[#0f72be] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleRequestPublish}
          disabled={!canRequest}
        >
          {stagingBusy ? 'Requesting...' : `Request Publish ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
        </button>
      </div>
    </div>
  );
}
