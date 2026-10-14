import { createHash, createHmac, randomBytes } from 'node:crypto';

type GatewayIdentity = { userId: string | number; tenantId?: string; scope?: 'user' | 'tenant' | 'repo' };

/** Sign server-to-server requests only after Studio has authorized the user/resource. */
export const fetchCodexGateway = (
  url: string,
  identity: GatewayIdentity,
  init: RequestInit = {},
): Promise<Response> => {
  const secret = process.env.ASSISTANT_GATEWAY_SECRET || '';
  if (Buffer.byteLength(secret) < 32 || secret.startsWith('replace_with_'))
    throw new Error('Configure the same private ASSISTANT_GATEWAY_SECRET in Studio and the assistant gateway');
  if (init.body !== undefined && init.body !== null && typeof init.body !== 'string')
    throw new Error('Gateway requests require a serialized JSON body');
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
    throw new Error('Invalid assistant gateway URL');
  const context = Buffer.from(JSON.stringify({
    v: 1, sub: String(identity.userId), tenant: identity.tenantId,
    scope: identity.scope || (identity.tenantId ? 'tenant' : 'user'),
    iat: Date.now(), nonce: randomBytes(16).toString('hex'),
  })).toString('base64url');
  const method = (init.method || 'GET').toUpperCase();
  const digest = createHash('sha256').update((init.body as string) || '').digest('hex');
  const signature = createHmac('sha256', secret)
    .update([method, target.pathname + target.search, context, digest].join('\n')).digest('hex');
  const headers = new Headers(init.headers);
  headers.set('x-runtessa-context', context);
  headers.set('x-runtessa-signature', signature);
  return fetch(url, { ...init, method, headers, redirect: 'error' });
};
