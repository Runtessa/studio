import type { PreviewInspectEvent, PreviewStage, PreviewTarget } from '@/components/editor/types';

type PreviewInspectPanelProps = {
  previewTarget: PreviewTarget | null;
  previewStage: PreviewStage;
  previewRoute: string;
  previewSession: string;
  previewSrc: string;
  tenantHost: string | null;
  events: PreviewInspectEvent[];
  onClearEvents: () => void;
};

const formatTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString();
};

export function PreviewInspectPanel({
  previewTarget,
  previewStage,
  previewRoute,
  previewSession,
  previewSrc,
  tenantHost,
  events,
  onClearEvents,
}: PreviewInspectPanelProps) {
  return (
    <aside className="flex h-full w-[360px] min-w-[300px] flex-col border-l border-[#2a2d2e] bg-[#1f1f1f] text-gray-200">
      <div className="flex items-center justify-between border-b border-[#2a2d2e] px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
          Preview Inspect
        </div>
        <button
          type="button"
          onClick={onClearEvents}
          className="rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 py-1 text-[10px] text-gray-200 hover:bg-[#2a2d2e]"
        >
          Clear
        </button>
      </div>

      <div className="space-y-2 border-b border-[#2a2d2e] px-3 py-2 text-[11px]">
        <div>
          <span className="text-gray-500">Target:</span>{' '}
          <span className="text-gray-200">
            {previewTarget ? `${previewTarget.name}@${previewTarget.version}` : 'None'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Stage:</span>{' '}
          <span className="text-gray-200">{previewStage}</span>
        </div>
        <div>
          <span className="text-gray-500">Route:</span>{' '}
          <span className="break-all text-gray-200">{previewRoute || '/'}</span>
        </div>
        <div>
          <span className="text-gray-500">Tenant:</span>{' '}
          <span className="break-all text-gray-200">{tenantHost || '-'}</span>
        </div>
        <div>
          <span className="text-gray-500">Session:</span>{' '}
          <span className="break-all font-mono text-gray-300">{previewSession}</span>
        </div>
        <div>
          <span className="text-gray-500">Iframe Src:</span>{' '}
          <span className="break-all font-mono text-gray-300">{previewSrc || '-'}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#2a2d2e] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">
          Events ({events.length})
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {events.length === 0 ? (
            <div className="rounded border border-[#2a2d2e] bg-[#1b1b1b] px-3 py-2 text-[11px] text-gray-500">
              No preview events yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="rounded border border-[#2a2d2e] bg-[#1b1b1b] p-2">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
                    <span className="text-gray-400">{event.kind || 'event'}</span>
                    <span className="text-gray-500">{formatTime(event.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-100">{event.message}</div>
                  {event.previewName || event.previewVersion || event.previewStage ? (
                    <div className="mt-1 text-[10px] text-gray-500">
                      {event.previewName ? event.previewName : '-'}
                      {event.previewVersion ? `@${event.previewVersion}` : ''}
                      {event.previewStage ? ` (${event.previewStage})` : ''}
                    </div>
                  ) : null}
                  {(event.requestUrl || event.sourceUrl || event.status) && (
                    <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                      {event.requestUrl ? (
                        <div className="break-all">
                          {event.method ? `${event.method} ` : ''}
                          {event.requestUrl}
                        </div>
                      ) : null}
                      {event.status ? <div>Status: {event.status}</div> : null}
                      {event.sourceUrl ? (
                        <div className="break-all">
                          {event.sourceUrl}
                          {event.line ? `:${event.line}` : ''}
                          {event.column ? `:${event.column}` : ''}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {event.href ? (
                    <div className="mt-1 break-all text-[10px] text-gray-500">
                      URL: {event.href}
                    </div>
                  ) : null}
                  {event.kernelBuild ? (
                    <div className="mt-1 break-all text-[10px] text-gray-500">
                      Kernel: {event.kernelBuild}
                    </div>
                  ) : null}
                  {event.componentStack ? (
                    <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded border border-[#2a2d2e] bg-[#151515] p-1 text-[10px] text-amber-300">
                      {event.componentStack}
                    </pre>
                  ) : null}
                  {event.stack ? (
                    <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded border border-[#2a2d2e] bg-[#151515] p-1 text-[10px] text-gray-400">
                      {event.stack}
                    </pre>
                  ) : null}
                  {event.responseSnippet ? (
                    <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded border border-[#2a2d2e] bg-[#151515] p-1 text-[10px] text-gray-400">
                      {event.responseSnippet}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
