import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '@idp/shared';
import { platformConnectionOptions } from '@idp/shared/dist/database/connection-options';
import { initializePlatformDataSource } from '@idp/shared/dist/database/schema-readiness';
import { hashPassword } from './password';

export const AppDataSource = new DataSource(platformConnectionOptions('ide'));
export const ensureSchema = async () => {
  await initializePlatformDataSource(AppDataSource, 'ide');
};

export const ensureAdminUser = async () => {
  await ensureSchema();
  const repo = AppDataSource.getRepository(User);
  const token = process.env.ADMIN_TOKEN;
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD;
  if (!token) throw new Error('ADMIN_TOKEN is required to bootstrap the admin user.');
  if (!password) throw new Error('ADMIN_PASSWORD is required to bootstrap the admin user.');
  let admin = await repo.findOne({ where: { email } });
  const passwordHash = await hashPassword(password);
  if (!admin) admin = repo.create({ email, token, passwordHash, role: 'admin' });
  else {
    admin.token = token;
    admin.passwordHash = passwordHash;
    admin.role = 'admin';
  }
  await repo.save(admin);
};
export const getDataSource = () => AppDataSource;
