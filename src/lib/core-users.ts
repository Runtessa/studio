import { User } from '@idp/shared';
import { CoreDataSource } from './core-db';

type CoreUserIdentity = {
  id: number;
  email: string;
  role?: string;
  token?: string | null;
};

export const ensureCoreUserIdentity = async (
  identity: CoreUserIdentity
): Promise<User> => {
  const repo = CoreDataSource.getRepository(User);

  const byId = await repo.findOne({ where: { id: identity.id } });
  if (byId) {
    let changed = false;
    if (byId.email !== identity.email) {
      byId.email = identity.email;
      changed = true;
    }
    if (identity.role && byId.role !== identity.role) {
      byId.role = identity.role;
      changed = true;
    }
    if (identity.token !== undefined && byId.token !== identity.token) {
      byId.token = identity.token;
      changed = true;
    }
    if (changed) {
      await repo.save(byId);
    }
    return byId;
  }

  const byEmail = await repo.findOne({ where: { email: identity.email } });
  if (byEmail) {
    if (identity.role && byEmail.role !== identity.role) {
      byEmail.role = identity.role;
      await repo.save(byEmail);
    }
    return byEmail;
  }

  const created = repo.create({
    id: identity.id,
    email: identity.email,
    role: identity.role || 'user',
    token: identity.token ?? null,
    passwordHash: null,
  });
  return await repo.save(created);
};
