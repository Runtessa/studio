import type { EntityManager } from 'typeorm';
import { GlobalUIPackage, UIPackage } from '@idp/shared';
import { getTailwindPackageName, isTailwindPackageName } from '../tailwindBuilder';

export type PublicationItem = {
  kind: 'module' | 'ui' | 'shared';
  id: string;
  sharedType?: string;
  data: Record<string, any>;
};

// CSS belongs to the submitted source snapshot, rather than the later editor draft.
export async function snapshotPublicationStyles(items: PublicationItem[], tenantId: string, manager: EntityManager) {
  for (const item of items) {
    if (item.kind !== 'ui' && !(item.kind === 'shared' && item.sharedType === 'ui')) continue;
    if (isTailwindPackageName(item.data.name)) continue;
    const name = getTailwindPackageName(item.data.name);
    const where = { name, version: item.data.version, ...(item.kind === 'ui' ? { tenant: { id: tenantId } } : {}) };
    const repo = manager.getRepository(item.kind === 'ui' ? UIPackage : GlobalUIPackage);
    const css = await repo.findOne({ where, relations: ['sourceCode', 'compiledCode'] });
    if (!css) {
      if (item.data.dependencies?.includes(name)) throw Object.assign(new Error('Required stylesheet is missing; rebuild before requesting publication'), { statusCode: 409 });
      continue;
    }
    item.data.stylesheet = {
      id: css.id, name: css.name, version: css.version, code: css.code,
      codeBlob: css.codeBlob, fileExtension: css.fileExtension, dependencies: [],
    };
  }
}
