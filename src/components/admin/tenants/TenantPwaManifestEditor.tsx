import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type TenantPwaManifestEditorProps = {
  value: string;
  error?: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (value: string) => void;
};

export function TenantPwaManifestEditor({
  value,
  error,
  expanded,
  onToggleExpanded,
  onChange,
}: TenantPwaManifestEditorProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-borderSubtle bg-bgApp p-5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-textPrimary">Manifest JSON</label>
          <p className="mt-1 text-xs text-textMuted">
            Advanced control for fields like `icons`, `description`, or a custom display mode.
          </p>
        </div>
        <Button type="button" variant="secondary" size="xs" onClick={onToggleExpanded}>
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>
      <div
        className={`overflow-hidden rounded-md border border-borderSubtle bg-bgSurface ${
          expanded ? 'h-[60vh]' : 'h-72'
        }`}
      >
        <MonacoEditor
          height="100%"
          language="json"
          theme="vs-dark"
          value={value}
          onChange={(nextValue) => onChange(nextValue ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
        />
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export default TenantPwaManifestEditor;
