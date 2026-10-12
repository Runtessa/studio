# Codex Instructions (AGENTS.md)

## Goals
- Split multi-module/god files into small single-responsibility modules.
- Reduce duplication by extracting reusable shared modules.
- Preserve behavior and public APIs (use re-export shims when needed).

## Boundaries
- Don’t edit generated/build/vendor/deps directories.
- Avoid circular dependencies; prefer shared/core -> domain -> adapters direction.

## Quality bar
- Run lint/tests/build after each refactor batch.
- Keep files small (<=200 lines target).
- Add/extend tests when extracting shared logic.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
