import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveTenant } from '@/lib/tenancy';
import { getAssistantRunSummary } from '@/lib/assistant/state-store';
import { assertAssistantRunAccess } from '@/lib/assistant/run-access';
import { requestAssistantStop } from '@/lib/assistant/run-control';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }
  const user = await requireUser(req);
  const tenant = await resolveTenant(req, user, 'ide.ui.read');
  const runId = String(req.query.runId || '').trim();
  const summary = await getAssistantRunSummary(tenant.id, runId);
  assertAssistantRunAccess(user, summary);
  if (summary?.status === 'running') await requestAssistantStop(tenant.id, runId);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ runId, stopping: summary?.status === 'running' });
});
