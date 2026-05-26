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
            />
          </span>
          <div className="leading-tight">
            <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              {branding.brand_name} Idp
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
            className="h-6 rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-200 hover:bg-[#2a2d2e]"
            title="Import existing React app into current tenant"
          >
            Import App
          </button>
        )}
        {editorView === 'preview' && (
          <div className="flex items-center gap-2 rounded-full border border-[#2a2d2e] bg-[#1f1f1f] px-2 py-0.5 text-[10px] text-gray-400">
            <span className="uppercase tracking-[0.2em]">Port</span>
            <input
              value={previewPort}
              onChange={(event) =>
                onPreviewPortChange(event.target.value.replace(/[^0-9]/g, ''))
              }
              placeholder={defaultPreviewPort}
              className="h-5 w-16 rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 text-[10px] text-gray-200 placeholder:text-gray-500 focus:border-[#0b5b96] focus:outline-none"
            />
            <span className="uppercase tracking-[0.2em]">Stage</span>
            <select
              value={previewStage}
              onChange={(event) =>
                onPreviewStageChange(event.target.value === 'published' ? 'published' : 'draft')
              }
              className="h-5 rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 text-[10px] text-gray-200 focus:border-[#0b5b96] focus:outline-none"
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
              className="h-5 w-72 rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 text-[10px] text-gray-200 placeholder:text-gray-500 focus:border-[#0b5b96] focus:outline-none"
              title="Preview route inside the iframe app (example: /dashboard?tab=home)."
            />
            <button
              type="button"
              onClick={onApplyPreviewRoute}
              className="h-5 rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 text-[10px] text-gray-200 hover:bg-[#2a2d2e]"
              title="Apply preview route"
            >
              Go
            </button>
            <button
              type="button"
              onClick={onResetPreviewRoute}
              className="h-5 rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 text-[10px] text-gray-200 hover:bg-[#2a2d2e]"
              title="Reset preview route to /"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onRefreshPreview}
              className="h-5 rounded border border-[#2a2d2e] bg-[#1b1b1b] px-2 text-[10px] text-gray-200 hover:bg-[#2a2d2e]"
              title="Refresh preview"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onTogglePreviewInspect}
              className={`h-5 rounded border px-2 text-[10px] ${
                previewInspectOpen
                  ? 'border-[#0b5b96] bg-[#0b5b96] text-white'
                  : 'border-[#2a2d2e] bg-[#1b1b1b] text-gray-200 hover:bg-[#2a2d2e]'
              }`}
              title="Toggle preview inspect panel"
            >
              Inspect
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-full border border-[#2a2d2e] bg-[#1f1f1f] p-0.5 text-[10px] uppercase tracking-wide text-gray-300">
          <button
            type="button"
            onClick={onSwitchToCode}
            className={`rounded-full px-3 py-0.5 transition ${
              editorView === 'code'
                ? 'bg-[#0b5b96] text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={onSwitchToPreview}
            className={`rounded-full px-3 py-0.5 transition ${
              editorView === 'preview'
                ? 'bg-[#0b5b96] text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Preview
          </button>
        </div>
      </div>
    </header>
  );
}
