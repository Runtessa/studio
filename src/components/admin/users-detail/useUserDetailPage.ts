import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/client/api';
import { useSessionToken } from '@/lib/client/session';
import { hasPermissionFromUser } from '@/lib/client/access';
import { IDE_ROLE_DESCRIPTIONS, IDE_ROLE_LABELS, type IdeRole } from '@/lib/rbac';
import type { UserDetailTabId } from './UserDetailTabs';
import { buildRoleAccessItems, roleOption, type UserListItem } from './userDetailModel';

export function useUserDetailPage() {
  const router = useRouter();
  const { token, setToken, ready } = useSessionToken();
  const { success } = useToast();
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UserDetailTabId>('settings');
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [userDetail, setUserDetail] = useState<UserListItem | null>(null);
  const [form, setForm] = useState({ email: '', password: '', token: '', role: 'user' });
  const [validationErrors, setValidationErrors] = useState({ email: '' });

  const emailRaw = router.query.email;
  const targetEmail = Array.isArray(emailRaw) ? emailRaw[0] : emailRaw;
  const decodedEmail = targetEmail ? decodeURIComponent(targetEmail) : '';
  const tabRaw = router.query.tab;
  const queryTab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;

  useEffect(() => {
    setActiveTab(queryTab === 'security' || queryTab === 'access' ? queryTab : 'settings');
  }, [queryTab]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token || !decodedEmail) return;
      try {
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Session ${token}` },
        });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || 'Failed to load user');
        const canManage = hasPermissionFromUser(meData.user, 'ide.users.manage');
        setIsAdmin(canManage);
        if (!canManage) {
          router.replace('/dashboard');
          return;
        }
        const list = await fetchJson('/api/users?page=1&limit=200', { token });
        const assignable: string[] = Array.isArray(list?.assignableRoles) ? list.assignableRoles : ['user'];
        const nextRoleOptions = assignable.map(roleOption);
        const match = (list.users as UserListItem[]).find((user) => user.email === decodedEmail);
        if (!match) {
          setError('User not found');
          return;
        }
        if (!nextRoleOptions.some((entry) => entry.value === match.role)) {
          nextRoleOptions.push(roleOption(match.role));
        }
        setRoleOptions(nextRoleOptions);
        setUserDetail(match);
        setForm({ email: match.email, password: '', token: match.token, role: match.role });
      } catch (err: any) {
        setError(err.message);
        if (err.message?.toLowerCase().includes('unauthorized')) setToken('');
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [token, ready, setToken, router, decodedEmail]);

  const generateToken = () => {
    const randomToken =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    setForm((prev) => ({ ...prev, token: randomToken }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setValidationErrors({ email: '' });
    if (!form.email) {
      setValidationErrors({ email: 'Email is required' });
      return;
    }
    try {
      const body: any = { email: form.email, token: form.token, role: form.role };
      if (form.password) body.password = form.password;
      const data = await fetchJson('/api/users', { method: 'PUT', token, body });
      success(`Updated user ${data.user.email}`);
      setUserDetail((current) =>
        current ? { ...current, role: form.role, token: form.token } : current
      );
      setForm((current) => ({ ...current, password: '' }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTabChange = (tab: UserDetailTabId) => {
    setActiveTab(tab);
    if (!decodedEmail) return;
    void router.replace(
      {
        pathname: `/admin/users/${encodeURIComponent(decodedEmail)}`,
        query: tab === 'settings' ? {} : { tab },
      },
      undefined,
      { shallow: true }
    );
  };

  const roleAccess = useMemo(() => buildRoleAccessItems(form.role), [form.role]);
  const roleDescription =
    IDE_ROLE_DESCRIPTIONS[form.role as IdeRole] || 'Select a role to view scope details.';

  return {
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
  };
}

export default useUserDetailPage;
