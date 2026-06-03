import type { FormEventHandler } from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  METHOD_OPTIONS,
  type EndpointFormErrors,
  type EndpointFormState,
  type SharedEndpoint,
} from './model';

type SharedModuleRoutesCardProps = {
  loading: boolean;
  canEditProject: boolean;
  projectName: string;
  endpoints: SharedEndpoint[];
  createForm: EndpointFormState;
  createErrors: EndpointFormErrors;
  editingEndpointId: string | null;
  editForm: EndpointFormState;
  editErrors: EndpointFormErrors;
  onCreateFormChange: (next: Partial<EndpointFormState>) => void;
  onEditFormChange: (next: Partial<EndpointFormState>) => void;
  onCreate: FormEventHandler<HTMLFormElement>;
  onStartEdit: (endpoint: SharedEndpoint) => void;
  onCancelEdit: () => void;
  onEdit: FormEventHandler<HTMLFormElement>;
  onDelete: (endpointId: string) => void;
};

export function SharedModuleRoutesCard({
  loading,
  canEditProject,
  projectName,
  endpoints,
  createForm,
  createErrors,
  editingEndpointId,
  editForm,
  editErrors,
  onCreateFormChange,
  onEditFormChange,
  onCreate,
  onStartEdit,
  onCancelEdit,
  onEdit,
  onDelete,
}: SharedModuleRoutesCardProps) {
  return (
    <DataCard title="Shared backend routes" subtitle="Attach externally callable routes to this backend package.">
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-textPrimary">Add route</h3>
            <p className="text-xs text-textMuted">
              Routes are the public entry points that dispatch into this shared backend package.
            </p>
          </div>
          <FormLayout
            onSubmit={onCreate}
            actions={<Button type="submit" variant="primary" disabled={!canEditProject}>Add route</Button>}
            gridClassName="grid gap-4 md:grid-cols-3"
          >
            <Input
              label="Route path"
              value={createForm.routePath}
              onChange={(event) => onCreateFormChange({ routePath: event.target.value })}
              error={createErrors.routePath}
              placeholder="/api/auth"
              disabled={!canEditProject}
            />
            <Select
              label="Method"
              value={createForm.method}
              options={METHOD_OPTIONS}
              onChange={(event) => onCreateFormChange({ method: event.target.value })}
              disabled={!canEditProject}
            />
            <Input label="Project" value={projectName || '—'} disabled />
          </FormLayout>
        </section>

        <section className="rounded-2xl border border-borderSubtle bg-bgSurface">
          <div className="border-b border-borderSubtle px-4 py-3 text-xs uppercase tracking-[0.18em] text-textMuted">
            {loading ? 'Loading routes…' : `${endpoints.length} routes`}
          </div>
          <div className="divide-y divide-borderSubtle">
            {endpoints.length === 0 && !loading ? (
              <div className="px-4 py-6 text-sm text-textMuted">No routes defined.</div>
            ) : (
              endpoints.map((endpoint) => (
                <div key={endpoint.id} className="px-4 py-4 text-sm text-textPrimary">
                  {editingEndpointId === endpoint.id ? (
                    <form onSubmit={onEdit} className="grid gap-3 md:grid-cols-4">
                      <Input
                        label="Route path"
                        value={editForm.routePath}
                        onChange={(event) => onEditFormChange({ routePath: event.target.value })}
                        error={editErrors.routePath}
                      />
                      <Select
                        label="Method"
                        value={editForm.method}
                        options={METHOD_OPTIONS}
                        onChange={(event) => onEditFormChange({ method: event.target.value })}
                      />
                      <Input label="Project" value={projectName || '—'} disabled />
                      <div className="flex items-end gap-2">
                        <Button type="submit" variant="primary" size="sm">
                          Save
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={onCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-bgApp px-2 py-0.5 text-xs uppercase text-textMuted">
                          {endpoint.method}
                        </span>
                        <span className="font-mono text-xs text-textPrimary">{endpoint.routePath}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => onStartEdit(endpoint)}
                          disabled={!canEditProject}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => onDelete(endpoint.id)}
                          disabled={!canEditProject}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </DataCard>
  );
}

export default SharedModuleRoutesCard;
