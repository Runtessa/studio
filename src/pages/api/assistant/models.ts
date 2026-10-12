import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { loadCodexModelCatalog } from '@/lib/assistant/model-catalog';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  try {
    res.status(200).json(await loadCodexModelCatalog(user.id, user.email));
  } catch (error) {
    res.status(503).json({ models: [], error: (error as Error).message });
  }
});
