import { useCallback } from 'react';
import { useSessionToken } from '@/lib/client/session';
import { fetchJson } from '@/lib/client/api';
import { getSelectedTenantHost } from '@/lib/client/tenant';

export const useApi = () => {
  const { token } = useSessionToken();

  const apiFetch = useCallback(
    async (url: string, options: any = {}) => {
      if (!token) throw new Error('Not authenticated');
      const tenantHost = getSelectedTenantHost();
      const headers = {
        ...options.headers,
        ...(tenantHost ? { 'X-Tenant-Host': tenantHost } : {}),
      };
      return fetchJson(url, { ...options, headers, token });
    },
    [token]
  );

  const adminFetch = apiFetch; // In this context, they are the same as they use the same token

  return { apiFetch, adminFetch };
};
