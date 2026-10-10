import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { platformConnectionOptions } from '@idp/shared/dist/database/connection-options';
import { initializePlatformDataSource } from '@idp/shared/dist/database/schema-readiness';
import { coreEntities } from '@idp/shared/dist/database/entities';

// The connection uses CORE_* settings; the metadata and migration stream are Core's.
export const CoreDataSource = new DataSource({
  ...platformConnectionOptions('catalog'), entities: coreEntities,
});
export const ensureCoreSchema = async (): Promise<void> => {
  await initializePlatformDataSource(CoreDataSource, 'core');
};
export const getCoreDataSource = () => CoreDataSource;
