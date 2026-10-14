import type { EntityManager } from 'typeorm';
import { GlobalModulePackage, GlobalUIPackage, HttpMethod, ModuleEntity, SourceCode, UIPackage } from '@idp/shared';
import type { ScopedUser } from '../team-tenant-access';
import { claimSharedProjectOwnershipIfNeeded, ensureSharedProjectPublishable } from '../shared-project-access';
import type { PublicationItem } from './style-snapshot';

type Context = { manager: EntityManager; tenantId: string; user: ScopedUser; revision: string; publishedAt: Date; cacheKeys: Set<string> };
const fail = (message: string) => Object.assign(new Error(message), { statusCode: 409 });

export async function publishItem(item: PublicationItem, context: Context): Promise<void> {
  const { manager, tenantId, user, revision, publishedAt, cacheKeys } = context;
  const isModule = item.kind === 'module';
  const isShared = item.kind === 'shared';
  const entity = isModule ? ModuleEntity : item.kind === 'ui' ? UIPackage
    : item.sharedType === 'ui' ? GlobalUIPackage : GlobalModulePackage;
  const repo = manager.getRepository(entity as typeof ModuleEntity);
  const where = { id: item.id, ...(!isShared ? { tenant: { id: tenantId } } : {}) };
  const record: any = await repo.findOne({ where, lock: { mode: 'pessimistic_write' } });
  if (!record) throw fail('A publication item was deleted or moved; submit a new request');
  if (isShared) claimSharedProjectOwnershipIfNeeded(record, ensureSharedProjectPublishable(user, record));
  const data = item.data;
  if (!data || typeof data.code !== 'string' || typeof data.fileExtension !== 'string') throw fail('Invalid publication snapshot');
  if (!isModule && (data.name !== record.name || data.version !== record.version)) throw fail('A publication package was renamed; submit a new request');
  const sourceRepo = manager.getRepository(SourceCode);
  const source = await sourceRepo.save(sourceRepo.create({ code: data.code }));
  record.publishedVersion = revision;
  record.publishedSourceCode = source;
  record.publishedFileExtension = data.fileExtension;
  record.publishedAt = publishedAt;
  if (isModule) {
    if (typeof data.routePath !== 'string' || !data.routePath.startsWith('/') || !Object.values(HttpMethod).includes(data.method)) throw fail('Invalid published route');
    const previousMethod = record.publishedMethod ?? record.method;
    record.publishedRoutePath = data.routePath;
    record.publishedMethod = data.method;
    for (const method of [previousMethod, data.method]) {
      cacheKeys.add(`module:published:${tenantId}:${method}`);
      cacheKeys.add(`module:published:${tenantId}:${method}:is_publish_workflow`);
    }
  } else {
    record.publishedCodeBlob = data.codeBlob;
    record.publishedDependencies = data.dependencies ?? [];
    const prefix = isShared ? 'registry:global' : `registry:tenant:${tenantId}`;
    for (const version of ['latest', record.version]) cacheKeys.add(`${prefix}:${encodeURIComponent(record.name)}:${version}`);
  }
  await repo.save(record);
  if (data.stylesheet) {
    await publishItem({ kind: item.kind, sharedType: item.sharedType, id: data.stylesheet.id, data: data.stylesheet }, context);
  }
}
