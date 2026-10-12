import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveTenant } from '@/lib/tenancy';
import { readAttachment, removeAttachment } from '@/lib/assistant/attachment-store';
import sharp from 'sharp';

export const config = { api: { responseLimit: '7mb' } };
export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (!['GET', 'DELETE'].includes(req.method || '')) { res.setHeader('Allow', 'GET, DELETE'); res.status(405).end(); return; }
  const user = await requireUser(req);
  const tenant = await resolveTenant(req, user, ['ide.ui.read']);
  const owner = { userId: user.id, tenantId: tenant.id };
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'DELETE') { await removeAttachment(owner, req.query.id); res.status(200).json({ ok: true }); return; }
  const { base64, ...attachment } = await readAttachment(owner, req.query.id);
  if (req.query.thumbnail === '1' && attachment.kind === 'image') {
    const thumbnail = await sharp(Buffer.from(base64, 'base64'), { limitInputPixels: 24_000_000 })
      .resize({ width: 240, height: 160, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    res.status(200).json({ attachment, previewImage: `data:image/webp;base64,${thumbnail.toString('base64')}` });
    return;
  }
  res.status(200).json({ attachment, base64 });
});
