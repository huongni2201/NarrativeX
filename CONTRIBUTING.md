# Contributing to NarrativeX

## Before opening a change

1. Read `AGENTS.md` and the relevant document under `documentation/`.
2. Confirm the change against the V1.11 project specification, accepted ADRs and current code. For factual AS-IS behavior, current code/migrations/tests outrank stale derived documentation.
3. Treat `app/desktop` as the primary editor client. Do not add new browser-only architecture to `app/frontend-web` unless the change explicitly maintains the temporary legacy migration client.
4. Keep the write scope focused and preserve unrelated worktree changes.
5. Add tests for new business rules, state transitions, contracts, security boundaries, local-storage invariants or execution lifecycle changes.

## Local checks

```powershell
# Backend
cd app/backend-service
./mvnw.cmd test

# Worker
cd ../ai-worker
python -m pytest
python -m ruff check .
python -m mypy src

# Desktop (primary client)
cd ../desktop
npm ci
npm run type-check
npm run build
```

If the change touches the legacy web client, also run:

```powershell
cd app/frontend-web
npm ci
npm run lint
npm run type-check
npm run build
```

The first run may require dependency downloads. Provider integrations must use deterministic fakes or mocked adapters in automated tests.

## Desktop rules

- Keep Node.js/process/filesystem access out of the renderer.
- Extend the preload bridge only with narrow, typed capabilities.
- Electron main owns native filesystem access, system-browser/deep-link handling, device credentials and FFmpeg execution.
- Desktop project media is local-first. Backend contracts use stable asset IDs/checksums and opaque project-relative artifact keys, never absolute local paths.
- Google OAuth is the only user-facing login flow. Do not reintroduce password login/register/forgot-password UI or runtime routes.
- Device tokens are local-execution credentials and must not be confused with user OAuth/session credentials.

## Documentation changes

Update the smallest relevant document, but update an ADR when a change crosses a client, storage, authentication or execution boundary. Keep `IMPLEMENTED`, `PARTIAL`, `TARGET`, `DEFERRED` and legacy/fallback behavior distinct.

For Desktop media/render behavior, ADR-0012 overrides the older cloud storage assumptions in ADR-0003. R2/Google Drive remain valid for cloud/legacy worker execution where that path still exists; they are not the Desktop project-media boundary.

## Pull request checklist

- [ ] Tests and type/lint/build checks pass for changed modules.
- [ ] No secrets, provider keys, personal data, absolute local project paths or production credentials were added.
- [ ] Migrations are backward-compatible or include a documented rollout plan.
- [ ] Idempotency, retry/UNKNOWN behavior, ownership, lease loss and optimistic-lock behavior are covered where relevant.
- [ ] Desktop preload/main security boundaries remain narrow.
- [ ] Documentation and contract versions match the implementation.
