import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveTenant } from '@/lib/tenancy';
import { deleteAssistantRun, getAssistantRun, getAssistantRunSummary } from '@/lib/assistant/state-store';
import { assertAssistantRunAccess } from '@/lib/assistant/run-access';
import { recoverInterruptedRun } from '@/lib/assistant/run-recovery';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  const tenant = await resolveTenant(req, user, 'ide.ui.read');
  const runId = String(req.query.runId ?? '').trim();
  if (!runId) {
    const error = new Error('runId is required');
    (error as any).statusCode = 400;
    throw error;
  }
  const summary = await getAssistantRunSummary(tenant.id, runId);
  assertAssistantRunAccess(user, summary);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') {
    if (summary?.status === 'running') {
      res.status(409).json({ error: 'Stop this run before deleting it' }); return;
    }
    await deleteAssistantRun(tenant.id, runId);
    res.status(204).end();
    return;
  }
  const run = await getAssistantRun(tenant.id, runId) || (summary ? await recoverInterruptedRun(tenant.id, summary) : null);
  if (!run && summary?.status === 'running') {
    res.status(200).json({ ...summary, pending: true, changes: [], events: [] }); return;
  }
  if (!run) {
    const error = new Error('Run not found');
    (error as any).statusCode = 404;
    throw error;
  }
  res.status(200).json(run);
});
