# Contributing to NarrativeX

## Before opening a change

1. Read `AGENTS.md` and the relevant document under `documentation/`.
2. Confirm the change against the V1.11 project specification, accepted ADRs and current code. For factual AS-IS behavior, current code/migrations/tests outrank stale derived documentation.
3. Treat `app/desktop` as the only editor client. Do not introduce a browser frontend or browser-only product architecture unless a new ADR explicitly reopens that decision.
4. Keep the write scope focused and preserve unrelated worktree changes.
5. Add tests for new business rules, state transitions, contracts, security boundaries, local-storage invariants or execution lifecycle changes.

## Local checks

Run the full provider-independent local quality gate before pushing or merging:

```powershell
pwsh -File scripts/verify-local.ps1
```

Windows PowerShell can run the same command with `powershell -File scripts/verify-local.ps1`.

For faster iteration, run only the narrow checks relevant to the files being changed. These development checks do not replace the full gate:

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

Provider integrations must use deterministic fakes or mocked adapters in ordinary automated tests.

## Desktop rules

- Keep Node.js/process/filesystem access out of the renderer.
- Extend the preload bridge only with narrow, typed capabilities.
- Electron main owns native filesystem access, system-browser/deep-link handling, backend session transport, device credentials and final FFmpeg execution.
- Desktop project media and final MP4 artifacts are local-first. Backend contracts use stable asset IDs/checksums and opaque project-relative keys, never absolute local paths.
- Generated project images, generated narration and imported project media must not use R2 as transport, fallback or dual write.
- `PROJECT` voice references remain project-local and resolve through ProjectStorage/`project.manifest.json` integrity metadata.
- `ACCOUNT` voice references/custom voices may use Cloudflare R2 through the account-owned `voices/...` storage boundary.
- Backend FinalArtifact persistence is metadata-only; final video bytes are not stored or proxied by backend/worker services.
- Google OAuth is the only user-facing login flow. Do not reintroduce password login/register/forgot-password UI or runtime routes.
- Device tokens are local-execution credentials and must not be confused with user OAuth/session credentials.

## Production timing rules

- Narration is the production master clock.
- New VisualBeat timing must preserve source provenance: `source_anchor -> UTF-16 textStart/textEnd -> narration alignment -> backend audio-clock mapping`.
- The Python worker owns source-anchor range resolution; backend `NarrationTextClockMapper` owns production text-to-audio mapping.
- Complete persisted beat audio spans may remain compatibility input, but provisional/fallback timing is review-only and must not make a render ready.
- Do not reintroduce the removed duration-weighted Python visual timing path as a production fallback.

## Production ingress

NarrativeX does not require a web frontend, Caddy or Redis. The default Compose startup is:

```powershell
docker compose up -d
```

It starts PostgreSQL, the backend and retained AI/narration workers. Production deployments must provide HTTPS ingress separately; `NARRATIVEX_PUBLIC_BASE_URL` must match that origin for Desktop system-browser OAuth and API/session traffic.

## Documentation changes

Update the smallest relevant document, but update an ADR when a change crosses a client, storage, authentication, timing-authority or execution boundary. Keep `IMPLEMENTED`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.

Current cross-cutting decisions include:

- ADR-0012: Desktop-local project/final bytes;
- ADR-0020: PostgreSQL-only MVP runtime;
- ADR-0021: Desktop Gemini Web boundary;
- ADR-0022: R2 voice-only storage and PROJECT/ACCOUNT voice-reference scope;
- ADR-0023: source-anchored narration-derived visual timing.

Historical ADR text remains rationale unless a newer ADR explicitly supersedes its scope.

## Pull request checklist

- [ ] Tests and type/lint/build checks pass for changed modules.
- [ ] `python scripts/check-docs-drift.py` passes when current-state docs change.
- [ ] No secrets, provider keys, personal data, absolute local project paths or production credentials were added.
- [ ] Migrations are backward-compatible or include a documented rollout plan.
- [ ] Idempotency, retry/UNKNOWN behavior, ownership, lease loss and optimistic-lock behavior are covered where relevant.
- [ ] Desktop preload/main security boundaries remain narrow.
- [ ] Documentation and contract versions match the implementation.
