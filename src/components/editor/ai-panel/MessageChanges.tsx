import { FiChevronRight, FiFileText, FiRotateCcw } from 'react-icons/fi';
import type { Dispatch, SetStateAction } from 'react';
import {
  MonacoDiffEditor,
  buildChangeDiffPayload,
  formatChange,
  uniqueChangeKey,
  type AiMessage,
  type ChangeDiffPayload,
} from './shared';

type Props = {
  msg: AiMessage;
  sending: boolean;
  openChangeDiffKeys: Record<string, boolean>;
  setOpenChangeDiffKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
  onOpenChangeInMainEditor?: (payload: ChangeDiffPayload) => void;
  onRollback: (message: AiMessage) => Promise<void>;
};
export function MessageChanges({
  msg,
  sending,
  openChangeDiffKeys,
  setOpenChangeDiffKeys,
  onOpenChangeInMainEditor,
  onRollback,
}: Props) {
  if (!msg.changes?.length) return null;
  return (
    <details className="group min-w-0 rounded-lg border border-[#2a2d2e] bg-[#1f1f1f]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] text-gray-300 hover:text-gray-100">
        <FiChevronRight aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90" />
        <FiFileText aria-hidden="true" className="shrink-0" />
        <span>
          Review {msg.changes.length} {msg.changes.length === 1 ? 'change' : 'changes'}
        </span>
      </summary>
      <div className="border-t border-[#2a2d2e] p-2 text-[11px] text-gray-300">
        <div className="space-y-2">
          {msg.changes!.map((change) => {
            const diff = buildChangeDiffPayload(change);
            const changeKey = `${msg.id}:${uniqueChangeKey(change)}`;
            const isDiffOpen = Boolean(openChangeDiffKeys[changeKey]);
            const originalModelPath = `file:///assistant-diff/${encodeURIComponent(changeKey)}.before`;
            const modifiedModelPath = `file:///assistant-diff/${encodeURIComponent(changeKey)}.after`;
            return (
              <details
                key={changeKey}
                className="overflow-hidden rounded border border-[#2a2d2e] bg-[#151515]"
                onToggle={(event) => {
                  const nextOpen = event.currentTarget.open;
                  setOpenChangeDiffKeys((prev) =>
                    prev[changeKey] === nextOpen ? prev : { ...prev, [changeKey]: nextOpen },
                  );
                }}
              >
                <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] text-gray-200 hover:bg-[#1f1f1f]">
                  {formatChange(change)}
                </summary>
                <div className="border-t border-[#2a2d2e]">
                  <div className="px-2 py-1 text-[10px] text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{diff.path}</span>
                      <button
                        type="button"
                        className="rounded border border-[#2a2d2e] px-2 py-0.5 text-[10px] text-gray-300 hover:bg-[#2a2d2e]"
                        onClick={() => onOpenChangeInMainEditor?.(diff)}
                      >
                        Open in editor
                      </button>
                    </div>
                  </div>
                  {isDiffOpen ? (
                    <MonacoDiffEditor
                      height="220px"
                      language={diff.language}
                      theme="vs-dark"
                      original={diff.before}
                      modified={diff.after}
                      originalModelPath={originalModelPath}
                      modifiedModelPath={modifiedModelPath}
                      keepCurrentOriginalModel={true}
                      keepCurrentModifiedModel={true}
                      options={{
                        readOnly: true,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        fontSize: 11,
                      }}
                    />
                  ) : (
                    <div className="px-2 py-2 text-[10px] text-gray-500">Expand to preview file diff</div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{msg.rolledBack ? 'Rolled back' : 'Auto-applied'}</span>
          {!msg.rolledBack && (
            <button
              type="button"
              className="flex items-center gap-1 rounded border border-[#2a2d2e] px-2 py-1 text-[10px] text-gray-200 hover:bg-[#2a2d2e]"
              disabled={sending || msg.status === 'running'}
              onClick={() => onRollback(msg)}
            >
              <FiRotateCcw className="h-3 w-3" />
              Rollback
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
