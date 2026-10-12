import { Tenant } from "@idp/shared";
import { CoreDataSource } from "@/lib/core-db";
import { normalizeAclEndpointsValue } from "./aclNormalization";
import type { AssistantChange } from './types';

export const ensureAclEndpoint = async (tenant: Tenant, routePath: string, changes?: AssistantChange[]) => {
  let inserted: AssistantChange | undefined;
  const endpoints = await CoreDataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Tenant);
    const current = await repo.findOne({
      where: { id: tenant.id },
      lock: { mode: "pessimistic_write" },
    });
    if (!current) throw new Error("Tenant not found");
    const existing = normalizeAclEndpointsValue(current.aclEndpoints);
    if (!existing[routePath]) {
      const before = structuredClone(existing);
      existing[routePath] = {
        read: [],
        write: [],
        edit: [],
        delete: [],
        allowAnonymous: false,
      };
      // A stale request snapshot must never overwrite permissions or roles that
      // were saved earlier in the same assistant run (or another request).
      await repo.update(tenant.id, { aclEndpoints: existing });
      inserted = { kind: 'acl', action: 'update', file: 'endpoints', before, after: structuredClone(existing) };
    }
    return existing;
  });
  tenant.aclEndpoints = endpoints;
  if (inserted) changes?.push(inserted);
};
