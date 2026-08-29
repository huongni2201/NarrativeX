# Contributing to NarrativeX

## Before opening a change

1. Read `AGENTS.md` and the relevant document under `documentation/`.
2. Confirm the change against the V1.11 project specification, accepted ADRs and current code. For factual AS-IS behavior, current code/migrations/tests outrank stale derived documentation.
3. Treat `app/desktop` as the only editor client. Do not introduce a browser frontend or browser-only product architecture unless a new ADR explicitly reopens that decision.
4. Keep the write scope focused and preserve unrelated worktree changes.
5. Add tests for new business rules, state transitions, contracts, security boundaries, local-storage invariants or execution lifecycle changes.

## Local checks

Run the full provider-independent local quality gate before pushing or merging. It fails
immediately on the first failed secret scan, test, formatter, lint, type, build, or Compose
validation command:

```powershell
pwsh -File scripts/verify-local.ps1
```

Windows PowerShell can run the same command with `powershell -File scripts/verify-local.ps1`.
The gate runs `mvnw.cmd verify` (including configured JaCoCo and Spotless checks), AI worker
tests/Ruff/mypy, Desktop `npm ci` plus tests/type-check/build, the repository secret scan,
and `docker compose config --quiet`. It does not require GitHub Actions minutes or tokens.

The first gate step is `python scripts/check-secrets.py`. It covers the provider credentials
used by NarrativeX (Google/GCP, AWS/R2, GitHub, Slack), bearer/JWT tokens,
database URLs with inline passwords, PEM private keys and non-placeholder environment
credentials. `${ENV_VAR}`, `<redacted>`, `change-me` and explicit `secret-scan: allow` fixture
markers are safe examples; do not use those allowlists for real credentials.

For faster iteration, run only the narrow checks relevant to the files being changed. These
are development checks and do not replace the full gate:

```powershell
# Backend
cd app/backend-service
./mvnw.cmd test

# Worker
cd ../ai-worker
python -m pytest
python -m ruff check .
python -m mypy src

# Desktop (only editor client)
cd ../desktop
npm ci
npm test
npm run type-check
npm run build
```

The first run may require dependency downloads. Provider integrations must use deterministic fakes or mocked adapters in automated tests.

An optional Git pre-push hook is included. Activate it explicitly for this checkout with:

```powershell
git config core.hooksPath .githooks
```

The hook invokes `scripts/verify-local.ps1`; application code never changes Git configuration.

## Desktop rules

- Keep Node.js/process/filesystem access out of the renderer.
- Extend the preload bridge only with narrow, typed capabilities.
- Electron main owns native filesystem access, system-browser/deep-link handling, backend session transport, device credentials and final FFmpeg execution.
- Desktop project media and final MP4 artifacts are local-first. Backend contracts use stable asset IDs/checksums and opaque project-relative artifact keys, never absolute local paths.
- Remote provider/worker media transport may use R2 only where the authorized flow requires durable bytes across that boundary; accepted project media must be materialized for local project use before final rendering.
- Backend FinalArtifact persistence is metadata-only; final video bytes are not stored or proxied by backend/worker services.
- Google OAuth is the only user-facing login flow. Do not reintroduce password login/register/forgot-password UI or runtime routes.
- Device tokens are local-execution credentials and must not be confused with user OAuth/session credentials.

## Production ingress

NarrativeX does not require a web frontend, Caddy or Redis. The default Compose startup is:

```powershell
docker compose up -d
```

It starts PostgreSQL, the backend and retained AI/narration workers. Production deployments
must provide HTTPS ingress separately; `NARRATIVEX_PUBLIC_BASE_URL` must match that origin
for Desktop system-browser OAuth and API/session traffic.

For production worker rollouts, set `BUILD_SHA` to the immutable Git revision and
configure the registry image prefixes in `.env.prod`. Then pull and recreate the
tagged services without rebuilding from an unknown checkout:

```powershell
docker compose pull backend ai-worker narration-worker
docker compose up -d --no-build backend ai-worker narration-worker
```

When the deployment builds locally instead of pulling a registry image, pass the same
revision while building:

```powershell
docker compose build --build-arg BUILD_SHA=$env:BUILD_SHA backend ai-worker narration-worker
docker compose up -d --no-build backend ai-worker narration-worker
```

After rollout, `docker compose logs narration-worker` should contain `Worker database
ready` with the expected `dbName`, `dbSchema`, `provider` and `buildSha` values.

## Documentation changes

Update the smallest relevant document, but update an ADR when a change crosses a client, storage, authentication or execution boundary. Keep `IMPLEMENTED`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.

For media/render behavior, ADR-0012 defines Desktop-local project/final bytes while ADR-0003 defines only remote generated-media transport. New server-side final-render or final-video storage paths require a new ADR.

## Pull request checklist

- [ ] Tests and type/lint/build checks pass for changed modules.
- [ ] No secrets, provider keys, personal data, absolute local project paths or production credentials were added.
- [ ] Migrations are backward-compatible or include a documented rollout plan.
- [ ] Idempotency, retry/UNKNOWN behavior, ownership, lease loss and optimistic-lock behavior are covered where relevant.
- [ ] Desktop preload/main security boundaries remain narrow.
- [ ] Documentation and contract versions match the implementation.
