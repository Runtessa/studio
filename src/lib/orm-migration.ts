import path from 'path';
import nodeModule from 'node:module';
import type * as RuntimeProcess from '@idp/shared/dist/runtime/restricted-process';
import type { OrmModelSource } from './orm-loader';
import type { OrmMigrationInput, migrateOrmSchema } from '@idp/shared/dist/runtime/orm-migrate';

export const migrateOrmModels = (models: OrmModelSource[], adapter: string, config: string | Record<string, unknown>, options: Pick<OrmMigrationInput, 'action' | 'expectedPlanHash' | 'operationId' | 'modelHash'> = {}) => {
  const nativeRequire = nodeModule.createRequire(path.join(process.cwd(), 'package.json'));
  // Resolve native files rather than letting Next relocate the filesystem boundary.
  const { runRestrictedProcess, runtimeDependencyRoots } = nativeRequire('@idp/shared/dist/runtime/restricted-process') as typeof RuntimeProcess;
  const entrypoint = nativeRequire.resolve('@idp/shared/dist/runtime/ormMigrationProcess.js');
  return runRestrictedProcess<Awaited<ReturnType<typeof migrateOrmSchema>>>({
    entrypoint, readOnlyRoots: [...runtimeDependencyRoots(), path.resolve(path.dirname(entrypoint), '../..')],
    input: { models, adapter, config, ...options }, timeoutMs: 30000, memoryMb: 512,
  });
};
