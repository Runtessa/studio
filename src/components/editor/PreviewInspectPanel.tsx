import { useMemo, useState } from 'react';
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

type EventTab = 'all' | 'runtime' | 'console' | 'network';

const formatTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString();
};

const categoryFromEvent = (event: PreviewInspectEvent): EventTab | 'system' => {
  if (event.category === 'runtime' || event.category === 'console' || event.category === 'network') {
    return event.category;
  }
  const kind = String(event.kind || '').toLowerCase();
  if (kind.startsWith('console-')) return 'console';
  if (kind.startsWith('network-') || kind === 'http-error') return 'network';
  if (kind.includes('runtime') || kind.includes('rejection') || kind.includes('render')) return 'runtime';
  return 'system';
};

const levelStyle = (level: string) => {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'error') return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (normalized === 'warn') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-blue-500/40 bg-blue-500/10 text-blue-200';
};

const tabs: Array<{ id: EventTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'console', label: 'Console' },
  { id: 'network', label: 'Network' },
];

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
  const [activeTab, setActiveTab] = useState<EventTab>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const next = { all: events.length, runtime: 0, console: 0, network: 0 };
    events.forEach((event) => {
      const category = categoryFromEvent(event);
      if (category === 'runtime') next.runtime += 1;
      if (category === 'console') next.console += 1;
      if (category === 'network') next.network += 1;
    });
    return next;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      const category = categoryFromEvent(event);
      if (activeTab !== 'all' && category !== activeTab) return false;
      if (!q) return true;
      const haystack = [
        event.kind,
        event.message,
        event.requestUrl,
        event.method,
        event.sourceUrl,
        event.statusText,
        event.responseSnippet,
      ]
        .map((part) => String(part || '').toLowerCase())
        .join('\n');
      return haystack.includes(q);
    });
  }, [activeTab, events, query]);

  return (
    <aside className="flex h-full w-[420px] min-w-[340px] flex-col border-l border-[#2a2d2e] bg-[#1f1f1f] text-gray-200">
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

      <div className="border-b border-[#2a2d2e] px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded border px-2 py-1 text-[10px] uppercase tracking-wide ${
                activeTab === tab.id
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-200'
                  : 'border-[#2a2d2e] bg-[#1b1b1b] text-gray-400 hover:bg-[#2a2d2e]'
              }`}
            >
              {tab.label} ({counts[tab.id]})
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by message/url/method..."
          className="mt-2 w-full rounded border border-[#2a2d2e] bg-[#151515] px-2 py-1 text-[11px] text-gray-100 outline-none placeholder:text-gray-500 focus:border-sky-400/40"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#2a2d2e] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">
          Events ({filteredEvents.length})
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filteredEvents.length === 0 ? (
            <div className="rounded border border-[#2a2d2e] bg-[#1b1b1b] px-3 py-2 text-[11px] text-gray-500">
              No events for this view.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => {
                const category = categoryFromEvent(event);
                return (
                  <div key={event.id} className="rounded border border-[#2a2d2e] bg-[#1b1b1b] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                        <span className="text-gray-400">{event.kind || 'event'}</span>
                        <span className="rounded border border-[#2a2d2e] px-1 text-gray-500">
                          {category}
                        </span>
                        <span className={`rounded border px-1 ${levelStyle(event.level)}`}>
                          {event.level}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">{formatTime(event.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-100">{event.message}</div>

                    {(event.requestUrl || event.sourceUrl || event.status || event.durationMs !== null) && (
                      <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                        {event.requestUrl ? (
                          <div className="break-all">
                            {event.method ? `${event.method} ` : ''}
                            {event.requestUrl}
                          </div>
                        ) : null}
                        {(event.status || event.statusText) && (
                          <div>
                            Status: {event.status ?? '-'}
                            {event.statusText ? ` ${event.statusText}` : ''}
                          </div>
                        )}
                        {event.durationMs !== null && event.durationMs !== undefined ? (
                          <div>
                            Duration: {event.durationMs}ms
                            {event.responseBytes !== null && event.responseBytes !== undefined
                              ? ` | Size: ${event.responseBytes}b`
                              : ''}
                          </div>
                        ) : null}
                        {event.requestId ? <div>Request: {event.requestId}</div> : null}
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
                      <div className="mt-1 break-all text-[10px] text-gray-500">URL: {event.href}</div>
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
