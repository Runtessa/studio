import path from 'path';
import nodeModule from 'node:module';
import type * as RuntimeProcess from '@idp/shared/dist/runtime/restricted-process';
import type { OrmModelSource } from './orm-loader';

export const migrateOrmModels = (models: OrmModelSource[], adapter: string, config: string | Record<string, unknown>) => {
  const nativeRequire = nodeModule.createRequire(path.join(process.cwd(), 'package.json'));
  // Resolve native files rather than letting Next relocate the filesystem boundary.
  const { runRestrictedProcess, runtimeDependencyRoots } = nativeRequire('@idp/shared/dist/runtime/restricted-process') as typeof RuntimeProcess;
  const entrypoint = nativeRequire.resolve('@idp/shared/dist/runtime/ormMigrationProcess.js');
  return runRestrictedProcess<{ ok: boolean; entities: number }>({
    entrypoint, readOnlyRoots: [...runtimeDependencyRoots(), path.resolve(path.dirname(entrypoint), '../..')],
    input: { models, adapter, config }, timeoutMs: 30000, memoryMb: 512,
  });
};
