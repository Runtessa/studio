import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import {
  PublishRequest,
  ModuleEntity,
  UIPackage,
  GlobalModulePackage,
  GlobalUIPackage,
  ModuleRevision,
  UIPackageRevision,
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
  resolvedOriginalCode?: string;
  resolvedModifiedCode?: string;
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const hasSource = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

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

const useIfPrevious = (candidate: string, requestedCode: string): string => {
  const normalized = normalizeForDiff(candidate);
  return hasSource(normalized) && normalized !== requestedCode ? normalized : '';
};

const getLatestModuleRevisionSource = async (
  item: PublishRequestItem,
  tenantId: string,
  requestedCode: string
): Promise<string> => {
  const revisions = await CoreDataSource.getRepository(ModuleRevision).find({
    where: { module: { id: item.id }, tenant: { id: tenantId } },
    relations: ['sourceCode'],
    order: { revision: 'DESC', createdAt: 'DESC' },
    take: 10,
  });
  const revision = revisions.find((candidate) => {
    const code = normalizeForDiff(candidate.code);
    return hasSource(code) && code !== requestedCode;
  });
  return revision ? normalizeForDiff(revision.code) : '';
};

const getLatestUiRevisionSource = async (
  item: PublishRequestItem,
  tenantId: string,
  requestedCode: string
): Promise<string> => {
  const revisions = await CoreDataSource.getRepository(UIPackageRevision).find({
    where: { uiPackage: { id: item.id }, tenant: { id: tenantId } },
    relations: ['sourceCode'],
    order: { revision: 'DESC', createdAt: 'DESC' },
    take: 10,
  });
  const revision = revisions.find((candidate) => {
    const code = normalizeForDiff(candidate.code);
    return hasSource(code) && code !== requestedCode;
  });
  return revision ? normalizeForDiff(revision.code) : '';
};

const getPublishedSourceCode = async (
  item: PublishRequestItem,
  tenantId: string,
  requestedCode: string
): Promise<string> => {
  const snapshotOriginal = asString(item.originalCode);
  const normalizedSnapshotOriginal = snapshotOriginal ? normalizeForDiff(snapshotOriginal) : '';

  if (item.kind === 'module') {
    const mod = await CoreDataSource.getRepository(ModuleEntity).findOne({
      where: { id: item.id, tenant: { id: tenantId } },
      relations: ['sourceCode', 'publishedSourceCode'],
    });
    const published = useIfPrevious(mod?.publishedCode ?? '', requestedCode);
    if (published) return published;
    const snapshot = useIfPrevious(normalizedSnapshotOriginal, requestedCode);
    if (snapshot) return snapshot;
    const revision = await getLatestModuleRevisionSource(item, tenantId, requestedCode);
    if (hasSource(revision)) return revision;
    return '';
  }

  if (item.kind === 'ui') {
    const pkg = await CoreDataSource.getRepository(UIPackage).findOne({
      where: { id: item.id, tenant: { id: tenantId } },
      relations: ['sourceCode', 'publishedSourceCode'],
    });
    const published = useIfPrevious(pkg?.publishedCode ?? '', requestedCode);
    if (published) return published;
    const snapshot = useIfPrevious(normalizedSnapshotOriginal, requestedCode);
    if (snapshot) return snapshot;
    const revision = await getLatestUiRevisionSource(item, tenantId, requestedCode);
    if (hasSource(revision)) return revision;
    return '';
  }

  if (item.sharedType === 'backend') {
    const pkg = await CoreDataSource.getRepository(GlobalModulePackage).findOne({
      where: { id: item.id },
      relations: ['sourceCode', 'publishedSourceCode'],
    });
    const published = useIfPrevious(pkg?.publishedCode ?? '', requestedCode);
    if (published) return published;
    const snapshot = useIfPrevious(normalizedSnapshotOriginal, requestedCode);
    if (snapshot) return snapshot;
    return '';
  }

  if (item.sharedType === 'ui') {
    const pkg = await CoreDataSource.getRepository(GlobalUIPackage).findOne({
      where: { id: item.id },
      relations: ['sourceCode', 'publishedSourceCode'],
    });
    const published = useIfPrevious(pkg?.publishedCode ?? '', requestedCode);
    if (published) return published;
    const snapshot = useIfPrevious(normalizedSnapshotOriginal, requestedCode);
    if (snapshot) return snapshot;
    return '';
  }

  // Backward-compatible fallback for old shared snapshots without sharedType
  const backendPkg = await CoreDataSource.getRepository(GlobalModulePackage).findOne({
    where: { id: item.id },
    relations: ['sourceCode', 'publishedSourceCode'],
  });
  const backendPublished = useIfPrevious(backendPkg?.publishedCode ?? '', requestedCode);
  if (backendPublished) return backendPublished;
  const snapshot = useIfPrevious(normalizedSnapshotOriginal, requestedCode);
  if (snapshot) return snapshot;

  const uiPkg = await CoreDataSource.getRepository(GlobalUIPackage).findOne({
    where: { id: item.id },
    relations: ['sourceCode', 'publishedSourceCode'],
  });
  const uiPublished = useIfPrevious(uiPkg?.publishedCode ?? '', requestedCode);
  if (uiPublished) return uiPublished;
  return snapshot;
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
      const publishedCode = await getPublishedSourceCode(item, request.tenant.id, requestedCode);

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
