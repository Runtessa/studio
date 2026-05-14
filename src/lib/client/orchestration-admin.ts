import { fetchJson } from '@/lib/client/api';

export type FleetAgent = {
  id: string;
  key: string;
  displayName?: string | null;
  runtimeType: 'docker' | 'k8s';
  serverHost?: string | null;
  status: 'online' | 'degraded' | 'offline';
  heartbeatAt?: string | null;
  labels?: Record<string, string> | null;
};

export type FleetWorkload = {
  id: string;
  key: string;
  name: string;
  runtimeType: 'docker' | 'k8s';
  state: 'running' | 'stopped' | 'removed';
  image: string;
  desiredReplicas: number;
  revision: number;
  updatedAt: string;
};

export type FleetOperation = {
  id: string;
  workloadId?: string | null;
  type: string;
  status: string;
  requestedBy?: string | null;
  createdAt: string;
  error?: string | null;
};

export const fetchAgents = async (token: string) => {
  const data = await fetchJson('/api/admin/orchestration/agents', { token });
  return Array.isArray(data?.agents) ? (data.agents as FleetAgent[]) : [];
};

export const fetchWorkloads = async (token: string) => {
  const data = await fetchJson('/api/admin/orchestration/workloads', { token });
  return Array.isArray(data?.workloads) ? (data.workloads as FleetWorkload[]) : [];
};

export const createWorkload = async (
  token: string,
  payload: {
    key: string;
    name: string;
    image: string;
    runtimeType: 'docker' | 'k8s';
    desiredReplicas: number;
    state?: 'running' | 'stopped' | 'removed';
  }
) => fetchJson('/api/admin/orchestration/workloads', { method: 'POST', token, body: payload });

export const updateWorkload = async (
  token: string,
  workloadId: string,
  payload: Partial<{
    name: string;
    image: string;
    runtimeType: 'docker' | 'k8s';
    desiredReplicas: number;
    state: 'running' | 'stopped' | 'removed';
  }>
) => fetchJson(`/api/admin/orchestration/workloads/${encodeURIComponent(workloadId)}`, {
  method: 'PATCH',
  token,
  body: payload,
});

export const removeWorkload = async (token: string, workloadId: string) =>
  fetchJson(`/api/admin/orchestration/workloads/${encodeURIComponent(workloadId)}`, {
    method: 'DELETE',
    token,
  });

export const fetchOperations = async (token: string, options?: { workloadId?: string; limit?: number }) => {
  const qs = new URLSearchParams();
  if (options?.workloadId) qs.set('workloadId', options.workloadId);
  if (Number.isFinite(Number(options?.limit)) && Number(options?.limit) > 0) {
    qs.set('limit', String(Math.floor(Number(options?.limit))));
  }
  const data = await fetchJson(`/api/admin/orchestration/operations${qs.toString() ? `?${qs.toString()}` : ''}`, {
    token,
  });
  return Array.isArray(data?.operations) ? (data.operations as FleetOperation[]) : [];
};
