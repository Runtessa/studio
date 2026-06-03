import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { UserAccessCard } from '@/components/admin/users-detail/UserAccessCard';
import { UserDetailTabs } from '@/components/admin/users-detail/UserDetailTabs';
import { UserSecurityCard } from '@/components/admin/users-detail/UserSecurityCard';
import { UserSettingsCard } from '@/components/admin/users-detail/UserSettingsCard';
import { UserWorkspaceSummary } from '@/components/admin/users-detail/UserWorkspaceSummary';
import { useUserDetailPage } from '@/components/admin/users-detail/useUserDetailPage';

export default function AdminUserEditPage() {
  const {
    ready,
    token,
    isAdmin,
    error,
    loading,
    activeTab,
    userDetail,
    roleOptions,
    form,
    validationErrors,
    roleDescription,
    roleAccess,
    setForm,
    generateToken,
    handleSubmit,
    handleTabChange,
    decodedEmail,
  } = useUserDetailPage();

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
        <PageHeader title="Edit user" subtitle="You do not have access to user management." />
        <DataCard title="Permission Denied" subtitle="Please contact an administrator." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={userDetail?.email || 'User details'}
        subtitle={decodedEmail ? `Manage ${decodedEmail}` : 'Manage user details.'}
        actions={
          <Button variant="secondary" size="sm" href="/admin/users">
            Back to users
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {loading ? <DataCard title="Loading user" subtitle="Please wait..." /> : null}

      {userDetail ? (
        <>
          <UserWorkspaceSummary user={userDetail} />
          <UserDetailTabs activeTab={activeTab} onChange={handleTabChange} />

          {activeTab === 'settings' ? (
            <UserSettingsCard
              email={form.email}
              role={form.role}
              roleOptions={roleOptions}
              roleDescription={roleDescription}
              roleError={validationErrors.email}
              onRoleChange={(role) => setForm((current) => ({ ...current, role }))}
              onSubmit={handleSubmit}
            />
          ) : activeTab === 'security' ? (
            <UserSecurityCard
              password={form.password}
              token={form.token}
              onPasswordChange={(password) => setForm((current) => ({ ...current, password }))}
              onTokenChange={(tokenValue) => setForm((current) => ({ ...current, token: tokenValue }))}
              onGenerateToken={generateToken}
              onSubmit={handleSubmit}
            />
          ) : (
            <UserAccessCard
              roleLabel={roleAccess.label}
              roleDescription={roleAccess.description}
              permissions={roleAccess.permissions}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
