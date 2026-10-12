import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiTrash2, FiX } from 'react-icons/fi';
import type { PreviewMark } from '@/lib/assistant/attachment-types';
import type { PreviewSnapshot } from './capturePreview';
import { normalizedRegion } from './attachmentFiles';

export function PreviewAnnotator({ snapshot, onCancel, onApply }: {
  snapshot: PreviewSnapshot; onCancel: () => void; onApply: (marks: PreviewMark[]) => Promise<void>;
}) {
  const [marks, setMarks] = useState<PreviewMark[]>([]), [selected, setSelected] = useState(0);
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null), note = useRef<HTMLTextAreaElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; cancel.current?.focus();
    return () => previous?.focus?.();
  }, []);
  useEffect(() => { if (marks.length) note.current?.focus(); }, [marks.length]);
  const position = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  };
  const pendingMark = drag ? normalizedRegion(drag.start, drag.end, snapshot.width, snapshot.height) : null;
  const button = 'rounded border border-[#3c3c3c] px-3 py-1.5 text-[12px] hover:bg-[#2a2d2e] disabled:opacity-40';
  const apply = async () => {
    setSaving(true); setError('');
    try { await onApply(marks); } catch (err) { setError((err as Error).message); setSaving(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="annotate-title" className="flex max-h-[94vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border border-[#3c3c3c] bg-[#252526] text-gray-100 shadow-2xl"
      onKeyDown={event => {
        if (event.key === 'Escape' && !saving) onCancel();
        if (event.key === 'Tab') {
          const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []);
          const first = elements[0], last = elements[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="flex items-center justify-between border-b border-[#3c3c3c] px-4 py-3"><div><h2 id="annotate-title" className="text-sm font-medium">Annotate preview</h2>
        <p className="mt-1 text-[11px] text-gray-400">Drag a region or click a point, then add a note. This captures the current preview.</p></div>
        <button ref={cancel} type="button" aria-label="Cancel annotation" disabled={saving} onClick={onCancel} className="p-2"><FiX /></button></header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 self-start"><div className="relative overflow-hidden rounded border border-[#3c3c3c] bg-white" style={{ aspectRatio: `${snapshot.width}/${snapshot.height}` }}>
          <img src={snapshot.image} alt="Current app preview" className="block h-full w-full" draggable={false} />
          <svg role="img" aria-label="Select preview regions" viewBox={`0 0 ${snapshot.width} ${snapshot.height}`} className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onPointerDown={event => { if (saving || marks.length >= 20 || event.button !== 0) return; const point = position(event); event.currentTarget.setPointerCapture(event.pointerId); setDrag({ start: point, end: point }); }}
            onPointerMove={event => { if (drag) setDrag({ ...drag, end: position(event) }); }}
            onPointerCancel={() => setDrag(null)}
            onPointerUp={event => { if (!drag) return; const mark = normalizedRegion(drag.start, position(event), snapshot.width, snapshot.height); setSelected(marks.length); setMarks(current => [...current, mark]); setDrag(null); }}>
            {[...marks, ...(pendingMark ? [pendingMark] : [])].map((mark, i) => <g key={i} onPointerDown={event => { if (i < marks.length) { event.stopPropagation(); setSelected(i); note.current?.focus(); } }}>
              <rect x={mark.x * snapshot.width} y={mark.y * snapshot.height} width={mark.width * snapshot.width} height={mark.height * snapshot.height} stroke="#007acc" strokeWidth={i === selected ? 4 : 2} fill="rgba(0,122,204,0.08)" />
              <rect x={mark.x * snapshot.width} y={mark.y * snapshot.height} width={25} height={25} fill="#007acc" />
              <text x={mark.x * snapshot.width + 12.5} y={mark.y * snapshot.height + 17} fill="white" fontFamily="sans-serif" fontSize={16} textAnchor="middle">{i + 1}</text>
            </g>)}
          </svg></div><p className="mt-2 text-[11px] text-gray-500">{snapshot.stage === 'draft' ? 'Draft' : 'Published'} · {snapshot.route} · {snapshot.width} × {snapshot.height}</p></div>
        <div className="min-w-0 space-y-3">
          {marks.length ? <><div className="flex flex-wrap gap-2">{marks.map((_, i) => <button key={i} disabled={saving} type="button" onClick={() => { setSelected(i); note.current?.focus(); }} className={`${button} ${i === selected ? 'bg-[#0b5b96]' : ''}`}>Region {i + 1}</button>)}</div>
            <label className="block text-[12px]">Note for region {selected + 1}<textarea ref={note} aria-label={`Note for region ${selected + 1}`} maxLength={1000} disabled={saving} value={marks[selected]?.note || ''}
              onChange={event => setMarks(current => current.map((mark, i) => i === selected ? { ...mark, note: event.target.value } : mark))}
              placeholder="What should change here?" className="mt-2 h-28 w-full resize-y rounded border border-[#3c3c3c] bg-[#1b1b1b] px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#007acc]" /></label>
            <button type="button" className={`${button} flex items-center gap-2`} disabled={saving} onClick={() => { setMarks(current => current.filter((_, i) => i !== selected)); setSelected(Math.max(0, selected - 1)); }}><FiTrash2 />Remove region</button>
          </> : <p className="text-[12px] text-gray-400">Select an area of the preview to start.</p>}
          {error ? <p role="alert" className="text-[12px] text-amber-200">{error}</p> : null}
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#3c3c3c] px-4 py-3"><button type="button" disabled={saving || !marks.length} className={button} onClick={() => { setMarks(current => current.slice(0, -1)); setSelected(Math.max(0, marks.length - 2)); }}>Undo</button>
        <div className="flex gap-2"><button type="button" disabled={saving} className={button} onClick={onCancel}>Cancel</button><button type="button" disabled={saving || !marks.length || marks.some(mark => !mark.note.trim())} onClick={() => void apply()} className="rounded bg-[#0b5b96] px-3 py-2 text-[12px] font-semibold hover:bg-[#0f72be] disabled:opacity-40">{saving ? 'Attaching…' : 'Add to chat'}</button></div></footer>
    </div>
  </div>, document.body);
}
