import { useEffect, useMemo, useState } from 'react';
import ContainerManagerLayout from '@/components/containers/ContainerManagerLayout';
import { DataCard } from '@/components/ui/DataCard';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAdminGuard } from '@/lib/client/use-admin-guard';
import { hasIdePermission } from '@/lib/rbac';
import {
  createWorkload,
  fetchAgents,
  fetchOperations,
  fetchWorkloads,
  removeWorkload,
  updateWorkload,
  type FleetAgent,
  type FleetOperation,
  type FleetWorkload,
} from '@/lib/client/orchestration-admin';

export default function ContainerFleetPage() {
  const { token, ready, isAdmin, user, loading: authLoading, error: authError } = useAdminGuard(
    'ide.containers.read'
  );
  const canManage =
    isAdmin ||
    hasIdePermission(user?.role || '', 'ide.containers.manage') ||
    Boolean(user?.permissions?.includes('ide.containers.manage'));
  const [agents, setAgents] = useState<FleetAgent[]>([]);
  const [workloads, setWorkloads] = useState<FleetWorkload[]>([]);
  const [operations, setOperations] = useState<FleetOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    key: '',
    name: '',
    image: '',
    runtimeType: 'docker' as 'docker' | 'k8s',
    desiredReplicas: 1,
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [agentsRows, workloadRows, operationRows] = await Promise.all([
        fetchAgents(token),
        fetchWorkloads(token),
        fetchOperations(token, { limit: 50 }),
      ]);
      setAgents(agentsRows);
      setWorkloads(workloadRows);
      setOperations(operationRows);
    } catch (err: any) {
      setError(err.message || 'Failed to load fleet state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !token || !isAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, isAdmin]);

  const stats = useMemo(() => {
    const online = agents.filter((a) => a.status === 'online').length;
    const running = workloads.filter((w) => w.state === 'running').length;
    return {
      agents: agents.length,
      onlineAgents: online,
      workloads: workloads.length,
      runningWorkloads: running,
      operations: operations.length,
    };
  }, [agents, workloads, operations]);

  const onCreate = async () => {
    if (!token) return;
    setError('');
    setSuccess('');
    try {
      await createWorkload(token, {
        key: form.key,
        name: form.name,
        image: form.image,
        runtimeType: form.runtimeType,
        desiredReplicas: Number(form.desiredReplicas || 1),
      });
      setForm((prev) => ({ ...prev, key: '', name: '', image: '', desiredReplicas: 1 }));
      setSuccess('Workload created');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to create workload');
    }
  };

  const onScale = async (workload: FleetWorkload, delta: number) => {
    if (!token) return;
    setBusyId(workload.id);
    setError('');
    setSuccess('');
    try {
      await updateWorkload(token, workload.id, {
        desiredReplicas: Math.max(0, Number(workload.desiredReplicas || 0) + delta),
        state: delta > 0 ? 'running' : workload.state,
      });
      setSuccess(`Scaled ${workload.key}`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to scale workload');
    } finally {
      setBusyId('');
    }
  };

  const onToggleState = async (workload: FleetWorkload) => {
    if (!token) return;
    setBusyId(workload.id);
    setError('');
    setSuccess('');
    try {
      const nextState = workload.state === 'running' ? 'stopped' : 'running';
      await updateWorkload(token, workload.id, { state: nextState });
      setSuccess(`${workload.key} set to ${nextState}`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update workload');
    } finally {
      setBusyId('');
    }
  };

  const onRemove = async (workload: FleetWorkload) => {
    if (!token) return;
    setBusyId(workload.id);
    setError('');
    setSuccess('');
    try {
      await removeWorkload(token, workload.id);
      setSuccess(`${workload.key} removed`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to remove workload');
    } finally {
      setBusyId('');
    }
  };

  return (
    <ContainerManagerLayout
      title="Fleet Orchestration"
      subtitle="Multi-agent workload management across Docker/K8s servers."
      onRefresh={() => void load()}
    >
      {authLoading || loading ? <DataCard title="Loading fleet state" subtitle="Please wait..." /> : null}

      {authError ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{authError}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-accent bg-bgApp px-4 py-3 text-sm text-accent">{success}</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-borderSubtle bg-bgSurface p-3">
          <div className="text-xs uppercase text-textMuted">Agents</div>
          <div className="mt-1 text-xl font-semibold text-textPrimary">{stats.agents}</div>
        </div>
        <div className="rounded-lg border border-borderSubtle bg-bgSurface p-3">
          <div className="text-xs uppercase text-textMuted">Agents Online</div>
          <div className="mt-1 text-xl font-semibold text-accent">{stats.onlineAgents}</div>
        </div>
        <div className="rounded-lg border border-borderSubtle bg-bgSurface p-3">
          <div className="text-xs uppercase text-textMuted">Workloads</div>
          <div className="mt-1 text-xl font-semibold text-textPrimary">{stats.workloads}</div>
        </div>
        <div className="rounded-lg border border-borderSubtle bg-bgSurface p-3">
          <div className="text-xs uppercase text-textMuted">Running</div>
          <div className="mt-1 text-xl font-semibold text-accent">{stats.runningWorkloads}</div>
        </div>
        <div className="rounded-lg border border-borderSubtle bg-bgSurface p-3">
          <div className="text-xs uppercase text-textMuted">Recent Ops</div>
          <div className="mt-1 text-xl font-semibold text-textPrimary">{stats.operations}</div>
        </div>
      </div>

      <DataCard title="Create Workload" subtitle="Declare desired workload state for fleet scheduler.">
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            label="Key"
            value={form.key}
            onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
            placeholder="codex-gateway-global"
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Codex Gateway"
          />
          <Input
            label="Image"
            value={form.image}
            onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))}
            placeholder="idp/codex-gateway:latest"
          />
          <Select
            label="Runtime"
            value={form.runtimeType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, runtimeType: event.target.value as 'docker' | 'k8s' }))
            }
            options={[
              { label: 'Docker', value: 'docker' },
              { label: 'Kubernetes', value: 'k8s' },
            ]}
          />
          <Input
            label="Replicas"
            value={String(form.desiredReplicas)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, desiredReplicas: Math.max(0, Number(event.target.value || 0)) }))
            }
          />
        </div>
        <div className="mt-3">
          <Button onClick={() => void onCreate()} disabled={!canManage}>
            Create Workload
          </Button>
        </div>
      </DataCard>

      <DataCard title="Agents" subtitle="Active agent nodes and runtime capability.">
        <DataTable headers={['Agent', 'Runtime', 'Status', 'Host', 'Heartbeat']} loading={loading}>
          {agents.map((agent) => (
            <tr key={agent.id} className="hover:bg-bgApp transition">
              <td className="px-4 py-3 text-textPrimary">{agent.displayName || agent.key}</td>
              <td className="px-4 py-3 text-textMuted">{agent.runtimeType}</td>
              <td className="px-4 py-3 text-textMuted">{agent.status}</td>
              <td className="px-4 py-3 text-textMuted">{agent.serverHost || '-'}</td>
              <td className="px-4 py-3 text-xs text-textMuted">
                {agent.heartbeatAt ? new Date(agent.heartbeatAt).toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </DataTable>
      </DataCard>

      <DataCard title="Workloads" subtitle="Desired state across all servers.">
        <DataTable headers={['Workload', 'Runtime', 'Image', 'State', 'Replicas', 'Actions']} loading={loading}>
          {workloads.map((workload) => (
            <tr key={workload.id} className="hover:bg-bgApp transition">
              <td className="px-4 py-3 text-textPrimary">
                <div className="font-medium">{workload.name}</div>
                <div className="text-xs text-textMuted">{workload.key}</div>
              </td>
              <td className="px-4 py-3 text-textMuted">{workload.runtimeType}</td>
              <td className="px-4 py-3 text-textMuted">{workload.image}</td>
              <td className="px-4 py-3 text-textMuted">{workload.state}</td>
              <td className="px-4 py-3 text-textMuted">{workload.desiredReplicas}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" disabled={!canManage || busyId === workload.id} onClick={() => void onScale(workload, -1)}>
                    -1
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!canManage || busyId === workload.id} onClick={() => void onScale(workload, 1)}>
                    +1
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!canManage || busyId === workload.id} onClick={() => void onToggleState(workload)}>
                    {workload.state === 'running' ? 'Stop' : 'Start'}
                  </Button>
                  <Button size="sm" variant="danger" disabled={!canManage || busyId === workload.id} onClick={() => void onRemove(workload)}>
                    Remove
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </DataCard>

      <DataCard title="Recent Operations" subtitle="Latest requested orchestration actions.">
        <DataTable headers={['When', 'Type', 'Status', 'Workload', 'Requested By', 'Error']} loading={loading}>
          {operations.map((op) => (
            <tr key={op.id} className="hover:bg-bgApp transition">
              <td className="px-4 py-3 text-xs text-textMuted">{new Date(op.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-textMuted">{op.type}</td>
              <td className="px-4 py-3 text-textMuted">{op.status}</td>
              <td className="px-4 py-3 text-xs text-textMuted">{op.workloadId || '-'}</td>
              <td className="px-4 py-3 text-textMuted">{op.requestedBy || '-'}</td>
              <td className="px-4 py-3 text-xs text-danger">{op.error || '-'}</td>
            </tr>
          ))}
        </DataTable>
      </DataCard>
    </ContainerManagerLayout>
  );
}
