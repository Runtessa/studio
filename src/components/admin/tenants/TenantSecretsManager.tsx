import dynamic from 'next/dynamic';
import { DataCard } from '@/components/ui/DataCard';
import { DataTable } from '@/components/ui/DataTable';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type SecretSummary = {
  keyName: string;
  updatedAt?: string;
};

type TenantSecretsManagerProps = {
  loading: boolean;
  canWrite: boolean;
  secrets: SecretSummary[];
  form: { keyName: string; value: string };
  saving: boolean;
  editorExpanded: boolean;
  onFormChange: (value: { keyName: string; value: string }) => void;
  onToggleExpanded: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onDelete: (keyName: string) => void;
};

export function TenantSecretsManager({
  loading,
  canWrite,
  secrets,
  form,
  saving,
  editorExpanded,
  onFormChange,
  onToggleExpanded,
  onSubmit,
  onDelete,
}: TenantSecretsManagerProps) {
  const sortedSecrets = [...secrets].sort((a, b) => a.keyName.localeCompare(b.keyName));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <DataCard
        title="Secret keys"
        subtitle="Store the actual secret values here. Adapter config should only reference these keys."
      >
        <DataTable headers={['Key name', 'Updated', 'Actions']} loading={loading} emptyMessage="No secrets yet.">
          {sortedSecrets.map((secret) => (
            <tr key={secret.keyName} className="text-sm transition hover:bg-bgApp">
              <td className="px-4 py-3 font-mono text-xs text-textPrimary">{secret.keyName}</td>
              <td className="px-4 py-3 text-textMuted">
                {secret.updatedAt ? new Date(secret.updatedAt).toLocaleString() : 'N/A'}
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete(secret.keyName)}
                  disabled={!canWrite}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </DataCard>

      <DataCard
        title="Add or update secret"
        subtitle="Values are encrypted at rest and never returned to the browser."
      >
        <FormLayout
          onSubmit={onSubmit}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onFormChange({ keyName: '', value: '' })}
                disabled={saving}
              >
                Clear
              </Button>
              <Button type="submit" variant="primary" disabled={saving || !canWrite}>
                {saving ? 'Saving...' : 'Save secret'}
              </Button>
            </>
          }
          gridClassName="grid gap-4"
        >
          <Input
            label="Key name"
            placeholder="adapter:redis:cache:default"
            value={form.keyName}
            onChange={(event) => onFormChange({ ...form, keyName: event.target.value })}
            disabled={!canWrite}
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-textPrimary">Secret value</label>
              <Button type="button" variant="secondary" size="xs" onClick={onToggleExpanded}>
                {editorExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>
            <div
              className={`overflow-hidden rounded-md border border-borderSubtle bg-bgSurface ${
                editorExpanded ? 'h-[60vh]' : 'h-40'
              }`}
            >
              <MonacoEditor
                height="100%"
                language="json"
                theme="vs-dark"
                value={form.value}
                onChange={(value) => onFormChange({ ...form, value: value ?? '' })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  readOnly: !canWrite,
                }}
              />
            </div>
          </div>
        </FormLayout>
      </DataCard>
    </div>
  );
}

export default TenantSecretsManager;
