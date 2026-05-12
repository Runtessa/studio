import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { FiFilter, FiExternalLink } from 'react-icons/fi';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DataTable } from '@/components/ui/DataTable';
import { useSessionToken } from '@/lib/client/session';
import { hasPermissionFromUser } from '@/lib/client/access';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';

export default function PublishRequestsPage() {
  const router = useRouter();
  const { adminFetch } = useApi();
  const { token, setToken, ready } = useSessionToken();
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token) return;
      try {
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Session ${token}` },
        });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || 'Failed to load user');
        setIsAdmin(hasPermissionFromUser(meData.user, 'ide.ui.publish'));
      } catch (err: any) {
        setError(err.message);
        if (err.message?.toLowerCase().includes('unauthorized')) {
          setToken('');
        }
      }
    };
    bootstrap();
  }, [ready, token, setToken]);

  useEffect(() => {
    const loadTenants = async () => {
      if (!ready || !token || isAdmin === false) return;
      try {
        setLoadingTenants(true);
        const data = await adminFetch('/api/admin/tenants?limit=100');
        setTenants(data.tenants || []);
      } catch (err) {
        console.error('Failed to load tenants:', err);
      } finally {
        setLoadingTenants(false);
      }
    };
    loadTenants();
  }, [adminFetch, ready, token, isAdmin]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  const loadRequests = async (tenantId: string, targetPage = 1) => {
    if (!tenantId || !token) {
      setRequests([]);
      return;
    }
    try {
      setLoading(true);
      const data = await adminFetch(`/api/admin/publish-requests?tenantId=${tenantId}&page=${targetPage}&limit=${pageSize}`);
      setRequests(data.requests || []);
      setPage(data.page ?? targetPage);
      setTotal(typeof data.total === 'number' ? data.total : (data.requests || []).length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTenantId && token) {
      loadRequests(selectedTenantId, page);
    } else {
      setRequests([]);
      setTotal(0);
    }
  }, [selectedTenantId, token, page]);

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
      <div className="space-y-6 p-6">
        <PageHeader title="Publish Requests" subtitle="You do not have permission to manage publish requests." />
        <DataCard title="Permission Denied" subtitle="Please contact an administrator." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Publish Requests"
        subtitle="Select a tenant to manage its pending publish requests."
        actions={
          selectedTenantId ? (
            <Button variant="secondary" size="sm" onClick={() => loadRequests(selectedTenantId, page)} disabled={loading}>
              Refresh
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <DataCard title="Filter" subtitle="Select a tenant to manage its pending publish requests.">
        <div className="max-w-md">
          <label className="mb-2 block text-sm font-medium text-textPrimary flex items-center gap-2">
            <FiFilter size={14} />
            Filter by Tenant
          </label>
          <Select
            value={selectedTenantId}
            onChange={(e) => {
              setSelectedTenantId(e.target.value);
              setPage(1);
            }}
            disabled={loadingTenants}
          >
            <option value="">-- Select a Tenant --</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.hostname}
              </option>
            ))}
          </Select>
        </div>
      </DataCard>

      <DataCard 
        title="Request List" 
        subtitle={selectedTenantId ? `Showing ${requests.length} requests (Total ${total})` : 'No tenant selected'}
      >
        <DataTable
          headers={['Status', 'Requester', 'Comment', 'Items', 'Created At', 'Actions']}
          loading={loading}
          emptyMessage={selectedTenantId ? 'No publish requests found for this tenant.' : 'Please select a tenant to view requests.'}
        >
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-bgApp transition">
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-rose-100 text-rose-700'
                }`}>
                  {req.status}
                </span>
                {req.tenant && (
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {req.tenant.hostname}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-textPrimary font-medium">
                {req.requester?.username || 'Unknown'}
              </td>
              <td className="px-4 py-3 text-textMuted italic truncate max-w-xs">
                "{req.comment}"
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-textPrimary">
                  {req.items?.length || 0} items
                </span>
              </td>
              <td className="px-4 py-3 text-textMuted text-xs">
                {formatDate(req.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="secondary"
                  size="xs"
                  href={`/admin/publish-requests/${req.id}`}
                >
                  <FiExternalLink className="mr-1" /> View Details
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
        
        {selectedTenantId && (
          <Pagination
            page={page}
            total={total}
            limit={pageSize}
            onPageChange={setPage}
          />
        )}
      </DataCard>
    </div>
  );
}
