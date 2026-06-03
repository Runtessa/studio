import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type TenantAdapterConfigEditorProps = {
  value: string;
  error?: string;
  expanded: boolean;
  secrets: string[];
  onToggleExpanded: () => void;
  onChange: (value: string) => void;
};

export function TenantAdapterConfigEditor({
  value,
  error,
  expanded,
  secrets,
  onToggleExpanded,
  onChange,
}: TenantAdapterConfigEditorProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-borderSubtle bg-bgApp p-5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-textPrimary">Adapter config JSON</label>
          <p className="mt-1 text-xs text-textMuted">
            Advanced runtime adapter map and secret-reference wiring for this tenant.
          </p>
        </div>
        <Button type="button" variant="secondary" size="xs" onClick={onToggleExpanded}>
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>
      <div
        className={`overflow-hidden rounded-md border border-borderSubtle bg-bgSurface ${
          expanded ? 'h-[70vh]' : 'h-56'
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
      <p className="text-xs text-textMuted">
        Existing secrets: {secrets.length ? secrets.join(', ') : 'none'}. Use secret refs such as
        {' '}
        `adapter:redis:cache:default`.
      </p>
    </div>
  );
}

export default TenantAdapterConfigEditor;
