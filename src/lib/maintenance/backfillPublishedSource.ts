import {
  GlobalModulePackage,
  GlobalUIPackage,
  ModuleEntity,
  ModuleRevision,
  PublishRequest,
  PublishRequestStatus,
  SourceCode,
  UIPackage,
  UIPackageRevision,
} from '@idp/shared';
import { IsNull, Not } from 'typeorm';
import { CoreDataSource } from '@/lib/core-db';

type BackfillOptions = {
  dryRun?: boolean;
  limitPerType?: number;
};

type BackfillSummary = {
  dryRun: boolean;
  scanned: {
    module: number;
    ui: number;
    sharedBackend: number;
    sharedUi: number;
  };
  updated: {
    module: number;
    ui: number;
    sharedBackend: number;
    sharedUi: number;
  };
  skippedNoSource: Array<{
    type: 'module' | 'ui' | 'sharedBackend' | 'sharedUi';
    id: string;
    reason: string;
  }>;
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalize = (value: string): string =>
  value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const requestItemKey = (item: any): string | null => {
  if (!item || typeof item !== 'object' || typeof item.kind !== 'string' || typeof item.id !== 'string') {
    return null;
  }
  if (item.kind === 'module') return `module:${item.id}`;
  if (item.kind === 'ui') return `ui:${item.id}`;
  if (item.kind === 'shared') {
    const sharedType = item.sharedType === 'ui' ? 'ui' : 'backend';
    return `shared:${sharedType}:${item.id}`;
  }
  return null;
};

const buildApprovedPublishSourceMap = async (): Promise<Map<string, string>> => {
  const repo = CoreDataSource.getRepository(PublishRequest);
  const requests = await repo.find({
    where: { status: PublishRequestStatus.APPROVED },
    order: { publishedAt: 'DESC', createdAt: 'DESC' },
  });

  const result = new Map<string, string>();
  for (const request of requests) {
    const items = Array.isArray(request.items) ? request.items : [];
    for (const item of items) {
      const key = requestItemKey(item);
      if (!key || result.has(key)) continue;
      const code = item?.data?.code;
      if (!nonEmpty(code)) continue;
      result.set(key, normalize(code));
    }
  }
  return result;
};

const getLatestModuleRevisionSource = async (moduleId: string): Promise<string | null> => {
  const repo = CoreDataSource.getRepository(ModuleRevision);
  const revision = await repo.findOne({
    where: { module: { id: moduleId } },
    relations: ['sourceCode'],
    order: { revision: 'DESC', createdAt: 'DESC' },
  });
  if (!revision || !nonEmpty(revision.code)) return null;
  return normalize(revision.code);
};

const getLatestUiRevisionSource = async (uiId: string): Promise<string | null> => {
  const repo = CoreDataSource.getRepository(UIPackageRevision);
  const revision = await repo.findOne({
    where: { uiPackage: { id: uiId } },
    relations: ['sourceCode'],
    order: { revision: 'DESC', createdAt: 'DESC' },
  });
  if (!revision || !nonEmpty(revision.code)) return null;
  return normalize(revision.code);
};

export const backfillMissingPublishedSource = async (
  options: BackfillOptions = {}
): Promise<BackfillSummary> => {
  const dryRun = options.dryRun ?? false;
  const limitPerType =
    typeof options.limitPerType === 'number' && options.limitPerType > 0
      ? Math.floor(options.limitPerType)
      : undefined;

  const sourceRepo = CoreDataSource.getRepository(SourceCode);
  const moduleRepo = CoreDataSource.getRepository(ModuleEntity);
  const uiRepo = CoreDataSource.getRepository(UIPackage);
  const sharedBackendRepo = CoreDataSource.getRepository(GlobalModulePackage);
  const sharedUiRepo = CoreDataSource.getRepository(GlobalUIPackage);

  const approvedSourceMap = await buildApprovedPublishSourceMap();

  const summary: BackfillSummary = {
    dryRun,
    scanned: { module: 0, ui: 0, sharedBackend: 0, sharedUi: 0 },
    updated: { module: 0, ui: 0, sharedBackend: 0, sharedUi: 0 },
    skippedNoSource: [],
  };

  const modules = await moduleRepo.find({
    where: {
      publishedVersion: Not(IsNull()),
      publishedSourceCode: IsNull(),
    },
    relations: ['sourceCode', 'publishedSourceCode'],
    take: limitPerType,
    order: { updatedAt: 'DESC' },
  });
  summary.scanned.module = modules.length;
  for (const mod of modules) {
    let candidate =
      approvedSourceMap.get(`module:${mod.id}`) ??
      (nonEmpty(mod.code) ? normalize(mod.code) : null);
    if (!candidate) candidate = await getLatestModuleRevisionSource(mod.id);
    if (!candidate) {
      summary.skippedNoSource.push({ type: 'module', id: mod.id, reason: 'no source candidate found' });
      continue;
    }
    if (!dryRun) {
      const source = sourceRepo.create({ code: candidate });
      await sourceRepo.save(source);
      mod.publishedSourceCode = source;
      await moduleRepo.save(mod);
    }
    summary.updated.module += 1;
  }

  const uiPackages = await uiRepo.find({
    where: {
      publishedVersion: Not(IsNull()),
      publishedSourceCode: IsNull(),
    },
    relations: ['sourceCode', 'publishedSourceCode'],
    take: limitPerType,
    order: { updatedAt: 'DESC' },
  });
  summary.scanned.ui = uiPackages.length;
  for (const pkg of uiPackages) {
    let candidate =
      approvedSourceMap.get(`ui:${pkg.id}`) ??
      (nonEmpty(pkg.code) ? normalize(pkg.code) : null);
    if (!candidate) candidate = await getLatestUiRevisionSource(pkg.id);
    if (!candidate) {
      summary.skippedNoSource.push({ type: 'ui', id: pkg.id, reason: 'no source candidate found' });
      continue;
    }
    if (!dryRun) {
      const source = sourceRepo.create({ code: candidate });
      await sourceRepo.save(source);
      pkg.publishedSourceCode = source;
      await uiRepo.save(pkg);
    }
    summary.updated.ui += 1;
  }

  const sharedBackends = await sharedBackendRepo.find({
    where: {
      publishedVersion: Not(IsNull()),
      publishedSourceCode: IsNull(),
    },
    relations: ['sourceCode', 'publishedSourceCode'],
    take: limitPerType,
    order: { updatedAt: 'DESC' },
  });
  summary.scanned.sharedBackend = sharedBackends.length;
  for (const pkg of sharedBackends) {
    const candidate =
      approvedSourceMap.get(`shared:backend:${pkg.id}`) ??
      (nonEmpty(pkg.code) ? normalize(pkg.code) : null);
    if (!candidate) {
      summary.skippedNoSource.push({
        type: 'sharedBackend',
        id: pkg.id,
        reason: 'no source candidate found',
      });
      continue;
    }
    if (!dryRun) {
      const source = sourceRepo.create({ code: candidate });
      await sourceRepo.save(source);
      pkg.publishedSourceCode = source;
      await sharedBackendRepo.save(pkg);
    }
    summary.updated.sharedBackend += 1;
  }

  const sharedUis = await sharedUiRepo.find({
    where: {
      publishedVersion: Not(IsNull()),
      publishedSourceCode: IsNull(),
    },
    relations: ['sourceCode', 'publishedSourceCode'],
    take: limitPerType,
    order: { updatedAt: 'DESC' },
  });
  summary.scanned.sharedUi = sharedUis.length;
  for (const pkg of sharedUis) {
    const candidate =
      approvedSourceMap.get(`shared:ui:${pkg.id}`) ??
      (nonEmpty(pkg.code) ? normalize(pkg.code) : null);
    if (!candidate) {
      summary.skippedNoSource.push({
        type: 'sharedUi',
        id: pkg.id,
        reason: 'no source candidate found',
      });
      continue;
    }
    if (!dryRun) {
      const source = sourceRepo.create({ code: candidate });
      await sourceRepo.save(source);
      pkg.publishedSourceCode = source;
      await sharedUiRepo.save(pkg);
    }
    summary.updated.sharedUi += 1;
  }

  return summary;
};

