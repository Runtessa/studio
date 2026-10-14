import type { DataSource } from 'typeorm';
import { PublishRequest, PublishRequestStatus, Tenant } from '@idp/shared';
import type { ScopedUser } from '../team-tenant-access';
import { assertTenantReadableForUser } from '../team-tenant-access';
import { assertPublishRequestItems } from '../publish-request-access';
import { generateVersion } from '../version';
import { publishItem } from './publish-item';
import type { PublicationItem } from './style-snapshot';

export async function approveRequest(source: DataSource, requestId: string, user: ScopedUser, approverId: number) {
  return source.transaction(async (manager) => {
    const repo = manager.getRepository(PublishRequest);
    // Lock only the root row: FOR UPDATE cannot lock nullable relation joins.
    const locked = await repo.findOne({ where: { id: requestId }, lock: { mode: 'pessimistic_write' } });
    if (!locked) throw Object.assign(new Error('Publish request not found'), { statusCode: 404 });
    const request = (await repo.findOne({ where: { id: requestId }, relations: ['tenant', 'requester'] }))!;
    await assertTenantReadableForUser(user, request.tenant.id);
    const tenant = await manager.getRepository(Tenant).findOne({ where: { id: request.tenant.id }, lock: { mode: 'pessimistic_read' } });
    if (!tenant || tenant.isSuspended) throw Object.assign(new Error('Tenant is suspended or unavailable'), { statusCode: 403 });
    await assertPublishRequestItems(user, request.items, manager);
    const cacheKeys = new Set<string>();
    if (request.status === PublishRequestStatus.APPROVED) return { request, cacheKeys };
    if (request.status !== PublishRequestStatus.PENDING) throw Object.assign(new Error('Only pending requests can be approved'), { statusCode: 409 });
    if (!request.items.length) throw Object.assign(new Error('Publication requires at least one item'), { statusCode: 400 });
    const publishedAt = new Date();
    const revision = generateVersion();
    const items = [...request.items].sort((a, b) => `${a.kind}:${(a as any).sharedType}:${a.id}`.localeCompare(`${b.kind}:${(b as any).sharedType}:${b.id}`));
    for (const item of items) await publishItem(item as PublicationItem, { manager, tenantId: tenant.id, user, revision, publishedAt, cacheKeys });
    request.status = PublishRequestStatus.APPROVED;
    request.approver = { id: approverId } as any;
    request.publishedAt = publishedAt;
    await repo.save(request);
    return { request, cacheKeys };
  });
}
