import Image from 'next/image';
import Link from 'next/link';

type EditorHeaderProps = {
  branding: { logo_lm: string; brand_name: string };
  editorView: 'code' | 'preview';
  isSharedMode: boolean;
  previewPort: string;
  previewRouteInput: string;
  previewStage: 'draft' | 'published';
  previewInspectOpen: boolean;
  defaultPreviewPort: string;
  onPreviewStageChange: (value: 'draft' | 'published') => void;
  onPreviewPortChange: (value: string) => void;
  onPreviewRouteInputChange: (value: string) => void;
  onApplyPreviewRoute: () => void;
  onResetPreviewRoute: () => void;
  onTogglePreviewInspect: () => void;
  onSwitchToCode: () => void;
  onSwitchToPreview: () => void;
  onRefreshPreview: () => void;
  onOpenImportReactApp: () => void;
};

export function EditorHeader({
  branding,
  editorView,
  isSharedMode,
  previewPort,
  previewRouteInput,
  previewStage,
  previewInspectOpen,
  defaultPreviewPort,
  onPreviewStageChange,
  onPreviewPortChange,
  onPreviewRouteInputChange,
  onApplyPreviewRoute,
  onResetPreviewRoute,
  onTogglePreviewInspect,
  onSwitchToCode,
  onSwitchToPreview,
  onRefreshPreview,
  onOpenImportReactApp,
}: EditorHeaderProps) {
  const headerActionButtonClass =
    'inline-flex h-6 items-center justify-center rounded-md bg-[#1b1b1b] px-2.5 text-[10px] font-semibold text-gray-200 transition hover:bg-[#2a2d2e] focus:outline-none focus:ring-1 focus:ring-[#0b5b96]/70';
  const headerInputClass =
    'h-6 rounded-md bg-[#1b1b1b] px-2 text-[10px] text-gray-200 placeholder:text-gray-500 transition focus:outline-none focus:ring-1 focus:ring-[#0b5b96]/70';
  const headerToggleButtonClass =
    'inline-flex h-6 items-center justify-center rounded-md px-3 text-[10px] font-semibold transition focus:outline-none';
  const activeToggleClass = 'bg-[#0b5b96] text-white';
  const inactiveToggleClass = 'text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200';

  return (
    <header className="relative flex h-[34px] items-center border-b border-[#2a2d2e] bg-[#252526] px-2">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a2d2e] bg-[#1e1e1e]">
            <Image
              src={branding.logo_lm}
              alt={branding.brand_name}
              width={18}
              height={18}
              className="rounded"
            />
          </span>
          <div className="leading-tight">
            <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              {branding.brand_name}
            </div>
            <div className="text-[12px] font-semibold text-gray-100">Editor Studio</div>
          </div>
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-2 text-[11px]">
        {!isSharedMode && (
          <button
            type="button"
            onClick={onOpenImportReactApp}
            className={`${headerActionButtonClass} uppercase tracking-wide`}
            title="Import existing React app into current tenant"
          >
            Import App
          </button>
        )}
        {editorView === 'preview' && (
          <div className="flex items-center gap-2 rounded-md bg-[#1f1f1f] px-2 py-0.5 text-[10px] text-gray-400">
            <span className="uppercase tracking-[0.2em]">Port</span>
            <input
              value={previewPort}
              onChange={(event) =>
                onPreviewPortChange(event.target.value.replace(/[^0-9]/g, ''))
              }
              placeholder={defaultPreviewPort}
              className={`${headerInputClass} w-16`}
            />
            <span className="uppercase tracking-[0.2em]">Stage</span>
            <select
              value={previewStage}
              onChange={(event) =>
                onPreviewStageChange(event.target.value === 'published' ? 'published' : 'draft')
              }
              className={headerInputClass}
              title="Draft loads unpublished latest changes. Published loads tenant published state."
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <span className="uppercase tracking-[0.2em]">Route</span>
            <input
              value={previewRouteInput}
              onChange={(event) => onPreviewRouteInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onApplyPreviewRoute();
                }
              }}
              placeholder="/"
              className={`${headerInputClass} w-72`}
              title="Preview route inside the iframe app (example: /dashboard?tab=home)."
            />
            <button
              type="button"
              onClick={onApplyPreviewRoute}
              className={headerActionButtonClass}
              title="Apply preview route"
            >
              Go
            </button>
            <button
              type="button"
              onClick={onResetPreviewRoute}
              className={headerActionButtonClass}
              title="Reset preview route to /"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onRefreshPreview}
              className={headerActionButtonClass}
              title="Refresh preview"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onTogglePreviewInspect}
              className={`${headerActionButtonClass} ${
                previewInspectOpen
                  ? 'bg-[#0b5b96] text-white'
                  : ''
              }`}
              title="Toggle preview inspect panel"
            >
              Inspect
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 rounded-md bg-[#1f1f1f] p-0.5 text-[10px] uppercase tracking-wide text-gray-300">
          <button
            type="button"
            onClick={onSwitchToCode}
            className={`${headerToggleButtonClass} ${
              editorView === 'code' ? activeToggleClass : inactiveToggleClass
            }`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={onSwitchToPreview}
            className={`${headerToggleButtonClass} ${
              editorView === 'preview' ? activeToggleClass : inactiveToggleClass
            }`}
          >
            Preview
          </button>
        </div>
      </div>
    </header>
  );
}
