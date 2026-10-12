import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveTenant } from '@/lib/tenancy';
import { saveAttachment } from '@/lib/assistant/attachment-store';

export const config = { api: { bodyParser: { sizeLimit: '7mb' } } };
export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).end(); return; }
  const user = await requireUser(req);
  const tenant = await resolveTenant(req, user, ['ide.ui.read']);
  const attachment = await saveAttachment({ userId: user.id, tenantId: tenant.id }, req.body);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(201).json({ attachment });
});
