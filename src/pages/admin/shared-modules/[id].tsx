import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { SharedModuleAccessCard } from '@/components/admin/shared-modules/SharedModuleAccessCard';
import { SharedModuleProjectCard } from '@/components/admin/shared-modules/SharedModuleProjectCard';
import { SharedModuleRoutesCard } from '@/components/admin/shared-modules/SharedModuleRoutesCard';
import { useSharedModuleEditor } from '@/components/admin/shared-modules/useSharedModuleEditor';

export default function AdminSharedModuleEditPage() {
  const {
    ready,
    token,
    isAdmin,
    error,
    loading,
    form,
    validationErrors,
    endpointLoading,
    endpointForm,
    endpointErrors,
    editingEndpointId,
    endpointEditForm,
    endpointEditErrors,
    canEditProject,
    teamOptions,
    ownerTeamId,
    editorTeamIds,
    canManageAccess,
    canChangeOwner,
    savingAccess,
    projectEndpoints,
    setForm,
    setEndpointForm,
    setEndpointEditForm,
    setOwnerTeamId,
    handleSubmit,
    handleEndpointCreate,
    startEditEndpoint,
    cancelEditEndpoint,
    handleEndpointEdit,
    handleEndpointDelete,
    toggleEditorTeam,
    handleSaveAccess,
  } = useSharedModuleEditor();

  if (ready && !token) {
    return (
      <div className="min-h-screen bg-bgApp px-4 py-10 text-left text-textPrimary">
        <div className="mx-auto w-full max-w-md space-y-3 rounded-xl border border-borderSubtle bg-bgSurface p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Please log in</h2>
          <p className="text-sm text-textMuted">
            Your session expired or is missing. <a href="/login" className="text-accent">Go to login</a>.
          </p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit shared backend" subtitle="You do not have access to shared backend projects." />
        <DataCard title="Permission Denied" subtitle="Please contact an administrator.">
          <div className="text-sm text-textMuted">Access requires an admin account.</div>
        </DataCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit shared backend"
        subtitle={form.name ? `Update ${form.name}` : 'Update shared backend project.'}
        actions={
          <Button variant="secondary" size="sm" href="/admin/shared-modules">
            Back to shared backends
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      <SharedModuleProjectCard
        title="Project details"
        subtitle="Update backend package metadata and runtime entry information."
        form={form}
        errors={validationErrors}
        loading={loading}
        canEdit={canEditProject}
        submitLabel="Save changes"
        onChange={(next) => setForm((current) => ({ ...current, ...next }))}
        onSubmit={handleSubmit}
      />

      <SharedModuleAccessCard
        teamOptions={teamOptions}
        ownerTeamId={ownerTeamId}
        editorTeamIds={editorTeamIds}
        canManageAccess={canManageAccess}
        canChangeOwner={canChangeOwner}
        savingAccess={savingAccess}
        onOwnerChange={setOwnerTeamId}
        onToggleEditorTeam={toggleEditorTeam}
        onSave={handleSaveAccess}
      />

      <SharedModuleRoutesCard
        loading={endpointLoading}
        canEditProject={canEditProject}
        projectName={form.name}
        endpoints={projectEndpoints}
        createForm={endpointForm}
        createErrors={endpointErrors}
        editingEndpointId={editingEndpointId}
        editForm={endpointEditForm}
        editErrors={endpointEditErrors}
        onCreateFormChange={(next) => setEndpointForm((current) => ({ ...current, ...next }))}
        onEditFormChange={(next) => setEndpointEditForm((current) => ({ ...current, ...next }))}
        onCreate={handleEndpointCreate}
        onStartEdit={startEditEndpoint}
        onCancelEdit={cancelEditEndpoint}
        onEdit={handleEndpointEdit}
        onDelete={handleEndpointDelete}
      />
    </div>
  );
}
