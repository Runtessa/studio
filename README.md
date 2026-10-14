# Runtessa studio

Browser development studio. Part of the private [Runtessa organization](https://github.com/Runtessa).

## Development workspace

Use the integration checkout to preserve shared-package paths, locks and cross-service tests:

```sh
git clone --recurse-submodules https://github.com/Runtessa/platform.git
cd platform
```

This repository mounts at `src/ideNew`. Follow the [platform setup and checks](https://github.com/Runtessa/platform/blob/main/CONTRIBUTING.md).
The current light/dark IDE and syntax colors are preserved.

## History and license

History was extracted from `src/ideNew` at platform commit `c25521a53a10b9f255bbfa5c05607fbde1330d69` without squashing.
Author identities, dates and commit messages are preserved; extracted commit IDs differ because paths are rooted here.
The complete original commit graph, all historical paths, branches, issues and pull requests remain in `Runtessa/platform`.
Apache-2.0; retain LICENSE, NOTICE and third-party notices.

---

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

## Authenticated preview

Studio authorizes Preview through the current IDE session and selected team's
tenant access. Set the server-only `CORE_PREVIEW_INTERNAL_URL` to Runtime and
configure the same dedicated `CORE_STUDIO_PREVIEW_TOKEN` in both services. Docker
environment initialization generates this credential automatically; existing
private environment files are preserved and require an explicit configuration
update. No new service is needed.

Preview credentials last ten minutes, renew while open, and reach only the exact
preview frame/origin. The preview attaches them only to its own Runtime requests,
not external package/CDN requests. They cannot manage Runtime code, ACL,
orchestration, or admin APIs. Running application routes still enforces tenant
ACL. End-user SSO remains a separate application login flow.

## Codex assistant reliability

The existing assistant gateway runs native Codex with each signed-in user's account.
It receives the authorized workspace, shared frontend/backend packages, active/open
editor buffers and selected source ranges. Keep the gateway available while using
Studio; its connection and model are shown in Agent settings.

Initialize coordinated native assistant credentials from the platform root with
`node scripts/assistant/init-secret.mjs`, then restart Studio and start the native
gateway as described in the
[gateway guide](https://github.com/Runtessa/assistant-gateway#connect-the-studio-assistant).
`ASSISTANT_GATEWAY_SECRET` stays in private server environment files. All login,
model, execution and workspace requests use the signed transport helper; user and
tenant identity come from Studio authorization. Missing or mismatched credentials
produce a connection error instead of an unauthenticated fallback.

Each request has an independent run ID. Repeated delivery of the same request nonce
reuses its result; different users, chats and fresh requests stay separate. Run
history and saved-change checkpoints are retained in Redis for seven days. Legacy
history remains intact; runs without recorded ownership are visible only to platform
administrators. Non-admin run pagination uses the user's own index. Browser chat
state is also scoped to the authenticated user and tenant. Ownerless legacy browser
chats remain stored and are imported only for platform administrators.

- **Read-only** runs use the native read-only sandbox and reject host mutation tools
  before applying a batch. The selection survives page reloads.
- **Stop** requests reach the server worker. The worker checks cancellation before
  applying further operations. An operation already being saved can finish; saved
  changes remain listed even when the overall run stops or fails.
- Reloading or disconnecting stops the active request. Studio recovers its recorded
  outcome instead of showing a false success or waiting indefinitely. Worker leases
  expire after 90 seconds without renewal; interrupted workers retain their last
  saved-change checkpoint. This recovers results, not background execution.
- Assistant writers are serialized per tenant and, when applying shared files, per
  shared package across tenants. The writer lease is renewed while work continues.
  Read-only requests do not hold these writer locks.
- Before applying a batch, Studio compares its touched files and ACL with the current
  stored workspace, accounting for the same run's previous changes. A stale snapshot
  fails with a conflict. Newer manual editor buffers survive streaming, recovery,
  completion and refresh; use the stored diff to reconcile them.

The stale-file check is a batch preflight, not a transaction spanning every application
write. A manual write racing the actual save still needs per-resource database version
checks for fully atomic conflict prevention. Native generation may also produce work
that fails platform validation; a failed run must be reviewed before retrying.

Validation: `npm run test:security`, `npm run type-check` and `npm run build`.
Reliability tests exercise unique history, ownership, idempotency, cancellation,
shared writer leases, interrupted recovery, stale files, and React buffer updater replays.

## Live model execution

Platform tables use [versioned migrations](../../scripts/database/README.md).
Core/IDE schema initialization checks history without changing tables. The old
`CORE_DB_SYNC` flag is ignored; prepare the platform database explicitly before
starting the IDE. Building or importing an API route does not initialize the
database or bootstrap the admin user; initialization starts on the first request.

Model code remains executable and can use native TypeORM decorators, relations
and methods. Loading and migration run in a restricted child process owned by the
existing IDE service. The platform key and database connection stay in the parent;
the child receives only the selected tenant adapter configuration. See
[`docker/runtime/README.md`](../../docker/runtime/README.md) for the Linux runtime
requirements, isolation tests and remaining network/resource limits.

Model schema updates now preview TypeORM's generated SQL and automatically apply
only additive statements. Dropping/renaming columns, changing existing types and
other unsupported changes return 409 before any planned DDL is executed. Use
`POST /api/models/migrate` with `action: "plan"` to inspect the plan; apply with
`action: "apply"` and its `expectedPlanHash` to reject a stale review. Ordinary
model saves retain safe table/column creation. PostgreSQL updates and their history
are transactional and serialized. MySQL DDL is not transactional; SQL Server and
MySQL need their own live integration verification.

## Publication consistency

Single-item publication and publish-request approval use transactions. Backend,
frontend, shared packages, submitted stylesheets and approval status commit
together or roll back together. Request approval is idempotent and approval/rejection
races cannot overwrite a completed decision. Stylesheet source is captured when
the request is submitted, so a later draft edit cannot change approved CSS.

Runtime caches are tied to database publication revisions. Redis cleanup after
commit is best effort and cannot serve the preceding revision to a new database
snapshot. An approval can return `cacheRefreshPending: true` after successful commit.
Published source and compiled code are separate snapshots from editable drafts.

Run `npm run test:data-safety` from the platform root for the native PostgreSQL
failure, concurrency, snapshot and stale-cache scenarios. Build Studio with
`NEXT_DIST_DIR=.next-build-check npm run build` to keep its output separate from a
running development session.

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

## Assistant attachments and preview annotations

Use the paperclip in the chat composer to attach PNG, JPEG or WebP images,
UTF-8 text, or source files. Multiple file selection, dropping files on the
composer, and pasting images are supported. Images can be opened at full size;
sent attachments can be downloaded. **Retry** keeps the original attachment
references, including preview notes.

To annotate the running app, open **Preview** and choose **Annotate preview** in
the composer. Studio captures the current iframe viewport. Drag a rectangle or
click a point, write a note for each numbered region, then choose **Add to chat**.
Undo, remove-region and Cancel do not modify the app. The full screenshot,
flattened region markers, notes, route and draft/published stage are sent only
when the chat message is sent. This does not add files to the tenant's codebase.

The Codex gateway receives real image inputs and reference-file contents;
filenames alone are not used as context. CLI-only/repository mode rejects
attachments with an actionable error instead of silently dropping them.

Limits: five attachments and 10 MB combined per message; 5 MB per still image,
256 KB per text/source file, 8192 pixels per image side and 24 million pixels.
PDF, office documents, archives, audio and video are not accepted. Uploaded
attachment downloads expire after seven days; an expired reference must be
reattached. Redis storage is scoped to the authenticated user and selected
tenant, with an atomic quota of 64 files / 100 MB per scope. Chat local storage
contains metadata and IDs, never file bytes. Codex's native conversation history
has its own lifecycle and can retain reference contents after downloads expire.

Preview capture uses the `html-to-image` renderer bundled by Kernel.
`npm --prefix src/kernel run build:preview` builds it; `build:front` includes
this step. Runtime serves the renderer
from its own origin; it never executes renderer scripts from the configured
Studio URL. The iframe bridge accepts messages only from its configured Studio parent, origin and session.
Studio checks the replying iframe, origin, session and request ID. It renders the
DOM viewport; embedded video, nested frames or inaccessible external assets may
not reproduce like a browser screenshot. Review the capture before sending.
