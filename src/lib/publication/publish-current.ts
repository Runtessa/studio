import type { DataSource } from 'typeorm';
import { GlobalModulePackage, GlobalUIPackage, ModuleEntity, UIPackage } from '@idp/shared';
import type { ScopedUser } from '../team-tenant-access';
import { generateVersion } from '../version';
import { publishItem } from './publish-item';
import { snapshotPublicationStyles, type PublicationItem } from './style-snapshot';

export async function publishCurrent(source: DataSource, target: Omit<PublicationItem, 'data'>, tenantId: string, user: ScopedUser) {
  return source.transaction(async (manager) => {
    const entity = target.kind === 'module' ? ModuleEntity : target.kind === 'ui' ? UIPackage
      : target.sharedType === 'ui' ? GlobalUIPackage : GlobalModulePackage;
    const repo = manager.getRepository(entity as typeof ModuleEntity);
    const where = { id: target.id, ...(target.kind !== 'shared' ? { tenant: { id: tenantId } } : {}) };
    if (!await repo.findOne({ where, lock: { mode: 'pessimistic_write' } })) throw Object.assign(new Error('Publication item not found'), { statusCode: 404 });
    const relations = ['sourceCode', 'publishedSourceCode', ...(target.kind !== 'module' ? ['compiledCode', 'publishedCompiledCode'] : [])];
    const row: any = await repo.findOne({ where, relations });
    const item: PublicationItem = { ...target, data: { code: row.code, codeBlob: row.codeBlob, name: row.name,
      version: row.version, dependencies: row.dependencies, fileExtension: row.fileExtension, routePath: row.routePath, method: row.method } };
    await snapshotPublicationStyles([item], tenantId, manager);
    const cacheKeys = new Set<string>();
    await publishItem(item, { manager, tenantId, user, revision: generateVersion(), publishedAt: new Date(), cacheKeys });
    const record = (await repo.findOne({ where, relations }))! as ModuleEntity | UIPackage | GlobalUIPackage | GlobalModulePackage;
    return { record, cacheKeys };
  });
}
