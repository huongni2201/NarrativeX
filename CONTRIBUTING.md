# Contributing to NarrativeX

## Before opening a change

1. Read `AGENTS.md`, `documentation/README.md` and the relevant current document under `documentation/`.
2. Confirm the change against the V1.11 source-of-truth specification, accepted ADRs and current code. For factual AS-IS behavior, current code/migrations/tests outrank derived documentation.
3. Check `documentation/decisions/README.md` before relying on an older ADR; some ADR scope is explicitly superseded.
4. Check `docs/superpowers/plans/README.md` before using an implementation plan. Plans are non-authoritative and must be ACTIVE/COMPLETED/SUPERSEDED.
5. Treat `app/desktop` as the only editor client. Do not introduce a browser frontend or browser-only product architecture unless a new ADR explicitly reopens that decision.
6. Keep the write scope focused and preserve unrelated worktree changes.
7. Add tests for new business rules, state transitions, contracts, security boundaries, local-storage invariants or execution lifecycle changes.

## Documentation checkpoint rule

Current documentation records an audited implementation checkpoint. Docs-only/governance commits may follow that checkpoint, but application/runtime changes may not silently advance beyond it.

When runtime code changes after the documented checkpoint:

1. audit affected current docs against the new code/migrations/tests;
2. update `TRACEABILITY.md` statuses without overclaiming planned work;
3. advance the checkpoint consistently in source-of-truth README/spec, Traceability, Feature Catalog and Roadmap;
4. run the docs governance/checkpoint guards.

`python scripts/check-docs-checkpoint.py` intentionally fails when application/runtime files changed after the audited checkpoint without a docs resync.

## Local checks

Run the full provider-independent local quality gate before pushing or merging:

```powershell
pwsh -File scripts/verify-local.ps1
```

Windows PowerShell can run the same command with `powershell -File scripts/verify-local.ps1`.

The gate includes documentation-governance tests/checkpoint drift guards, secret scanning, backend tests/format/coverage, AI-worker tests/Ruff/mypy, Desktop lockfile install/tests/type-check/build and Compose validation. It does not require GitHub Actions minutes or tokens.

Focused docs governance checks:

```powershell
python -m unittest scripts/test_check_docs_drift.py scripts/test_check_docs_checkpoint.py
python scripts/check-docs-drift.py
python scripts/check-docs-checkpoint.py
```

The repository secret scan covers provider credentials, bearer/JWT tokens, database URLs with inline passwords, PEM private keys and non-placeholder environment credentials. `${ENV_VAR}`, `<redacted>`, `change-me` and explicit `secret-scan: allow` fixture markers are safe examples; do not use those allowlists for real credentials.

For faster iteration, run narrow checks relevant to changed modules; they do not replace the full gate:

```powershell
# Backend
cd app/backend-service
./mvnw.cmd test

# Worker
cd ../ai-worker
python -m pytest
python -m ruff check .
python -m mypy src

# Desktop
cd ../desktop
npm ci
npm test
npm run type-check
npm run build
```

Provider integrations must use deterministic fakes/mocked adapters in ordinary automated tests.

An optional Git pre-push hook is included. Activate it explicitly for this checkout with:

```powershell
git config core.hooksPath .githooks
```

The hook invokes `scripts/verify-local.ps1`; application code never changes Git configuration.

## Desktop rules

- Keep Node.js/process/filesystem access out of renderer.
- Extend preload only with narrow typed capabilities.
- Electron main owns native filesystem access, system-browser/deep-link handling, backend session transport, device credentials, Gemini Web Chrome/CDP automation and final FFmpeg execution.
- Desktop project media/final MP4 are local-first. Backend contracts use stable asset IDs/checksums and project-relative/opaque keys, never absolute local paths.
- AI-generated images/narration may use R2 while remote provider/worker execution requires durable transport, then are materialized for local project use where required.
- Backend FinalArtifact persistence is metadata-only; final video bytes are not stored/proxied by backend/worker services.
- Google OAuth is the only user-facing account login flow. Do not reintroduce password login/register/forgot-password product behavior.
- Device tokens are local-execution credentials and must not be confused with user OAuth/session credentials.
- Gemini Web credentials/sign-in state stay in the visible user-owned Chrome session; do not move that provider path into renderer or Python worker without an ADR.

## Visual Beat timing rules

Current code has semantic VisualBeat materialization and narration alignment persistence, but exact storyboard timing reconciliation is not complete.

Do not claim a timing feature implemented merely because nullable database columns exist. In particular:

- AI must not calculate numeric character offsets/audio timestamps;
- exact VisualBeat `text_start/text_end` remains active work until deterministic materialization exists;
- exact VisualBeat `audio_start_ms/audio_end_ms` remains active work until source-compatible narration reconciliation exists;
- generic production-timeline fallback geometry is not exact narration alignment;
- current immutable MediaPlan timing wins for production/render planning.

## Production ingress/runtime

NarrativeX does not require a web frontend, Caddy or Redis. Default Compose startup is:

```powershell
docker compose up -d
```

It starts PostgreSQL, backend and configured AI/narration worker services. Production deployments provide HTTPS ingress separately; `NARRATIVEX_PUBLIC_BASE_URL` must match that origin for Desktop system-browser OAuth and API/session traffic.

For production worker rollouts, set `BUILD_SHA` to the immutable Git revision and configure registry image prefixes in `.env.prod`. Pull/recreate tagged services without rebuilding from an unknown checkout.

Current Python supervisor roles are `analysis`, `narration`, `media-validation`, `image-generation`; there is no Python final-render worker role.

## Persistence and Flyway

Production backend persistence is MyBatis + explicit PostgreSQL SQL.

NarrativeX is pre-production. V1-V8 are a clean development baseline and may still be reorganized before first production deployment. If a baseline rewrite changes history/checksums, recreate disposable local/test databases rather than preserving obsolete patch migrations.

At first production deployment, freeze the accepted applied baseline. After that point:

- never rewrite an applied migration;
- add new schema evolution only as append-only later versions (starting V9+ for the current baseline);
- document rollout/backfill compatibility for production migrations.

Do not apply a generic “all migrations must already be backward-compatible upgrade history” rule to the current pre-release baseline.

## Documentation changes

Update the smallest relevant current docs, but update/add an ADR when a change crosses client, storage, authentication or execution boundaries.

Lifecycle rules:

- `documentation/` is current except ADR bodies;
- ADR bodies remain historical decision evidence; supersession belongs in `documentation/decisions/README.md`;
- plans under `docs/superpowers/plans/` are non-authoritative execution aids and require lifecycle status;
- retired migration reports/obsolete implementation notes belong in Git history, not current navigation;
- keep `IMPLEMENTED`, `IMPLEMENTED foundation`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.

For media/render behavior, ADR-0012 defines Desktop-local project/final bytes while ADR-0003 applies only to its non-superseded remote generated-media/provider scope. New server-side final-render/final-video storage paths require a new ADR.

## Pull request checklist

- [ ] Tests and type/lint/build checks pass for changed modules.
- [ ] Documentation governance/checkpoint tests pass.
- [ ] No secrets, provider keys, personal data, absolute local project paths or production credentials were added.
- [ ] Source/version/idempotency/retry/UNKNOWN/ownership/lease/optimistic-lock behavior is covered where relevant.
- [ ] Desktop preload/main security boundaries remain narrow.
- [ ] Flyway changes follow pre-release baseline policy or post-production append-only policy as applicable.
- [ ] Current docs, Traceability status and audited checkpoint match implementation without upgrading plan-only work.
