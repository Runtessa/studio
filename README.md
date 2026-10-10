# ADA Idp Dashboard & API

Next.js control panel and API for managing users, session tokens, and audit logs.

## Stack
- Next.js (pages router), React, TypeScript, Tailwind
- Postgres for users and login sessions
- Redis for session caching

## Getting Started
1) Install deps: `npm install`  
2) Copy env: `cp .env.example .env` (update database URL and admin credentials)  
3) Run dev server: `npm run dev` (Next on http://localhost:3000)

## Scripts
- `npm run dev` — start Next.js in dev mode
- `npm run build` — production build
- `npm start` — serve built app
- `npm run type-check` — TypeScript checks
- `npm run test:security` — tenant scope, role permissions, publication, and rollback regression tests

## Project Structure
- `src/pages` — API routes and UI pages (login, dashboard, docs, admin/users)
- `src/layouts` — app shell, header layout
- `src/components` — dashboard, layout, and UI primitives
- `src/lib` — database, auth, client helpers
- `src/styles` — global Tailwind styles

Path aliases: `@/*` points to `src/*` (configured in `tsconfig.json`).

## Notes
- Admin credentials and API tokens are driven by environment variables; update `.env` before first run.
- Session tokens are cached in Redis for quicker auth checks.

## Tenant authorization

Tenant resolution requires the authenticated user and checks active-team membership
before returning tenant configuration. Tenant API routes supply their resource
permission explicitly: model read/write/migrate, module read/write, UI
read/write/publish, and ACL read/write. Platform administrators retain cross-team
access. A tenant administrator is limited to tenants assigned to their active team.

Publication requests check both the request's tenant and each resource permission;
shared publication additionally requires the owning team's access. Assistant
rollback validates the complete batch before writing, checks tenant/project scope,
and inserts restored records without overwriting existing IDs. Client snapshots
cannot override tenant ownership or published fields.

The security tests exercise actual handler and guard functions with in-memory
repository/authentication doubles. They do not replace a live database, HTTP,
concurrency, or penetration test. Run them along with the type check and production
build when changing authorization.

## Live model execution

Model code remains executable and can use native TypeORM decorators, relations
and methods. Loading and migration run in a restricted child process owned by the
existing IDE service. The platform key and database connection stay in the parent;
the child receives only the selected tenant adapter configuration. See
[`docker/runtime/README.md`](../../docker/runtime/README.md) for the Linux runtime
requirements, isolation tests and remaining network/resource limits.

## Request diagnostics

Failed API requests record status, method, pathname, error class and source frames.
Request bodies, query values, URL credentials/fragments, exception messages and raw
stacks are omitted. Structured metadata masks credential fields and raw payload
containers. Logging storage failures emit a fixed message without the rejected
database query or parameters. Auth and Core use safe exception summaries; Core SQL
diagnostics record event type and timing without SQL text or bound values.

Run `npm run test:logging` from the repository root. Tests exercise the real logger,
API wrappers, bootstrap, error handler and database logger with synthetic secrets
and dependency doubles. Existing database and platform logs are not rewritten by
these changes. Avoid adding free-form request content to log messages or metadata.

## Existing encryption keys

`CORE_ENCRYPTION_KEY` protects rows in `secrets` and encrypted `enc:` values in tenant
adapter configuration. The current payload has no key version and both Core and
IDE use a single active key. Replacing only the environment value makes existing
ciphertext unreadable. Rotation requires a database backup, an inventory of all
encrypted values, re-encryption with verification, and a coordinated Core/IDE key
switch. Provider credentials and signing/session keys require separate revocation
and service updates. Do not treat history cleanup as credential revocation.
