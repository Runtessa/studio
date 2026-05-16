import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { ensureCoreSchema } from '@/lib/core-db';
import { backfillMissingPublishedSource } from '@/lib/maintenance/backfillPublishedSource';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  await requireAdmin(req);
  await ensureCoreSchema();

  const dryRun = req.body?.dryRun !== false;
  const limitPerType =
    typeof req.body?.limitPerType === 'number' && req.body.limitPerType > 0
      ? Math.floor(req.body.limitPerType)
      : undefined;

  const summary = await backfillMissingPublishedSource({
    dryRun,
    limitPerType,
  });

  res.status(200).json(summary);
});

