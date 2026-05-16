import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import {
  PublishRequest,
  PublishRequestStatus,
  SourceCode,
} from '@idp/shared';

type PublishRequestItem = {
  kind: 'module' | 'ui' | 'shared';
  sharedType?: 'backend' | 'ui';
  id: string;
  title?: string;
  data?: {
    code?: string;
    codeBlob?: string;
    fileExtension?: string;
    [key: string]: unknown;
  };
  originalCode?: string | null;
  originalSourceCodeId?: string | null;
  resolvedOriginalCode?: string;
  resolvedModifiedCode?: string;
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const normalizeForDiff = (value: string): string => {
  let normalized = value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    normalized = normalized
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
  }
  return normalized;
};

const getRequestedCode = (item: PublishRequestItem): string => {
  const source = asString(item.data?.code);
  if (source !== null) return normalizeForDiff(source);
  return '';
};

const isSamePublishedItem = (candidate: PublishRequestItem, item: PublishRequestItem): boolean =>
  candidate.kind === item.kind &&
  candidate.id === item.id &&
  (candidate.kind !== 'shared' ||
    !item.sharedType ||
    !candidate.sharedType ||
    candidate.sharedType === item.sharedType);

const getSnapshotOriginalCode = async (item: PublishRequestItem): Promise<string | null> => {
  const snapshotOriginal = asString(item.originalCode);
  if (snapshotOriginal !== null) return normalizeForDiff(snapshotOriginal);

  if (item.originalSourceCodeId) {
    const source = await CoreDataSource.getRepository(SourceCode).findOne({
      where: { id: item.originalSourceCodeId },
    });
    if (source) return normalizeForDiff(source.code);
  }

  return null;
};

const getHistoricalPublishedCode = async (
  item: PublishRequestItem,
  tenantId: string,
  requestCreatedAt: Date
): Promise<string> => {
  const previousRequests = await CoreDataSource.getRepository(PublishRequest)
    .createQueryBuilder('pr')
    .leftJoin('pr.tenant', 'tenant')
    .where('tenant.id = :tenantId', { tenantId })
    .andWhere('pr.status = :status', { status: PublishRequestStatus.APPROVED })
    .andWhere(
      '((pr.published_at IS NOT NULL AND pr.published_at < :requestCreatedAt) OR (pr.published_at IS NULL AND pr.created_at < :requestCreatedAt))',
      { requestCreatedAt }
    )
    .orderBy('COALESCE(pr.published_at, pr.created_at)', 'DESC')
    .take(100)
    .getMany();

  for (const previousRequest of previousRequests) {
    const previousItems = Array.isArray(previousRequest.items) ? previousRequest.items : [];
    const previousItem = previousItems.find((candidate) =>
      isSamePublishedItem(candidate as PublishRequestItem, item)
    ) as PublishRequestItem | undefined;
    const previousCode = asString(previousItem?.data?.code);
    if (previousCode !== null) return normalizeForDiff(previousCode);
  }

  return '';
};

const getPublishedSourceCode = async (
  item: PublishRequestItem,
  tenantId: string,
  requestCreatedAt: Date
): Promise<string> => {
  const snapshotOriginal = await getSnapshotOriginalCode(item);
  if (snapshotOriginal !== null) return snapshotOriginal;

  return getHistoricalPublishedCode(item, tenantId, requestCreatedAt);
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireAdmin(req);
  await ensureCoreSchema();

  const { id } = req.query;

  const repo = CoreDataSource.getRepository(PublishRequest);
  const request = await repo.findOne({
    where: { id: id as string },
    relations: ['requester', 'approver', 'tenant'],
  });

  if (!request) {
    res.status(404).json({ error: 'Publish request not found' });
    return;
  }

  const items = Array.isArray(request.items) ? request.items : [];
  const normalizedItems = await Promise.all(
    items.map(async (rawItem: any) => {
      const item = rawItem as PublishRequestItem;
      const requestedCode = getRequestedCode(item);
      const publishedCode = await getPublishedSourceCode(item, request.tenant.id, request.createdAt);

      return {
        ...item,
        resolvedOriginalCode: publishedCode,
        resolvedModifiedCode: requestedCode,
      };
    })
  );

  res.status(200).json({
    ...request,
    items: normalizedItems,
  });
});
