# NarrativeX repository guidance

## Source of truth and document lifecycle

For factual AS-IS behavior, current code, Flyway migrations and automated tests are authoritative. The maintained product/architecture baseline is `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`, implementation evidence is `documentation/TRACEABILITY.md`, and cross-cutting decision history is indexed in `documentation/decisions/README.md`.

Documentation lifecycle:

- `documentation/` is current except ADR bodies;
- `documentation/decisions/ADR-*.md` is historical decision evidence and may contain explicitly superseded scope;
- `docs/superpowers/plans/` is non-authoritative implementation planning and requires ACTIVE/COMPLETED/SUPERSEDED status in its README;
- retired migration reports/obsolete implementation notes stay in Git history rather than current navigation.

Do not infer implementation from an ADR, plan or nullable schema column. If runtime/application code advances beyond the documented implementation checkpoint, affected current docs must be audited and the synchronized checkpoint advanced.

## Non-negotiable domain rules

- PostgreSQL is authoritative for durable business state, durable queues, server-managed HTTP sessions and one-time Desktop OAuth handoffs. Redis is not required by the MVP runtime. Python workers discover and claim work by polling durable PostgreSQL tables; do not add a broker/cache without a measured need and explicit ADR.
- Keep the Spring Boot application modular-monolith shaped. Do not introduce microservices without a measured bottleneck and explicit ADR.
- Story text, prompts, references and provider output are untrusted data. Enforce prompt-injection boundaries, schema validation, provider/media safety handling and output review at the relevant boundary.
- Never assume 60 minutes, 2,000 words, one sentence per image or a fixed image count. Visual planning is duration + semantic complexity + reuse/delta based.
- Character is a reusable User/Workspace-owned identity, never a Project-owned duplicate.
- Project participation is modeled through ProjectCharacter.
- Character identity/version state uses CharacterVersion; timeline/project appearance changes use CharacterAppearance/OutfitVersion rather than duplicating Character identity.
- Explicitly pinned CharacterVersion state is not silently replaced by later AI analysis.
- Scene/VisualBeat AI context resolves participating Characters only. A VisualBeat Character must already participate in its parent Scene and uses `PRIMARY`, `SECONDARY`, or `BACKGROUND` as visual participation metadata.
- Persist provider reservation/submission fences before external paid work. Ambiguous outcomes become `UNKNOWN` and reconcile before retry; never blind-resubmit.
- Expensive operations require backend-authorized planning/admission, entitlement/quota checks, idempotency and usage attribution appropriate to the workflow.
- Server-side entitlement is authoritative for watermark, quality, export, concurrency and quota rules.
- Real-person references require applicable consent/use-right/privacy/retention handling.
- `app/desktop` is the only editor client. Do not recreate `app/frontend-web` or add a parallel browser editor without an explicit ADR.
- Desktop renderer code uses real APIs only. Mock data is limited to isolated tests/fixtures and must never be selected by production/runtime configuration.
- Authentication identity originates in Spring Security infrastructure, but business/application modules obtain caller identity through auth application ports such as `CurrentUserId`; do not accept `X-User-Id` or equivalent client-controlled identity headers.
- End-user account authentication is Google OAuth only. Desktop starts OAuth in the system browser, receives a one-time handoff through `narrativex://auth/callback`, then establishes a server-managed `NX_SESSION`. Google access/refresh tokens never enter Electron.
- The stable installation guest identity is an internal ownership/session mechanism, not a second end-user login provider.
- Local device tokens are separate machine credentials for heartbeat/render APIs and must not be confused with user OAuth/session credentials.
- Renderer styling uses centralized design tokens/semantic variables and source-owned primitives; avoid ad-hoc hardcoded visual values when an existing semantic token fits.

## Visual Beat timing rules

Keep three coordinate systems separate:

```text
Chapter source
  -> VisualBeat text_start/text_end
  -> narration source-to-audio alignment
  -> VisualBeat audio_start_ms/audio_end_ms
  -> global production timeline startMs/endMs
```

Current audited implementation has semantic VisualBeat materialization, narration alignment persistence, immutable MediaPlan timing and generic production-timeline fallback geometry.

Current non-claims:

- deterministic VisualBeat `text_start/text_end` are not yet materialized for every analyzed beat;
- narration completion does not yet reconcile every storyboard beat into exact `audio_start_ms/audio_end_ms`;
- generic fallback timeline geometry is not exact narration alignment;
- fully verified narration-clock-authoritative draft preview remains TARGET/PARTIAL.

AI must not count numeric character offsets or invent audio timestamps. A current valid immutable MediaPlan timing snapshot wins for production/render planning. Nullable aspect/quality override fields mean inherited policy when null, not missing required AI output.

## Runtime and deployment boundaries

- Electron renderer owns UI/routing/query/editor state only; unrestricted Node.js/process/filesystem access stays out of renderer.
- Electron preload exposes narrow typed task-specific capabilities only.
- Electron main owns native filesystem access, protected credentials, system-browser/deep-link handling, backend session transport, ProjectStorage, local device execution, FFmpeg/ffprobe and Gemini Web visible Chrome/CDP automation.
- Gemini Web is not a Python worker path. Main owns the series/reference prompt wrapper, deterministic Character-reference attachment, protected clipboard and fresh network-response byte capture; visible Download control is fallback rather than the preferred byte path.
- Desktop project bytes are local-first and represented to backend through stable IDs/checksums plus opaque/project-relative keys, never absolute local filesystem paths.
- Final project rendering is backend-assigned/lease-controlled but executes in Electron main. Final MP4 bytes remain local; backend persists metadata only.
- Python worker supervisor roles are `analysis`, `narration`, `media-validation`, and `image-generation`. There is no Python final-render worker role.
- Production Compose has no web frontend, Caddy or Redis service. PostgreSQL is the only application state service required by the MVP runtime.
- HTTPS ingress is external to `docker-compose.yml`; set `NARRATIVEX_PUBLIC_BASE_URL` to the externally provided HTTPS origin for production OAuth/API traffic.

## Persistence and Flyway

- Production application persistence uses MyBatis + explicit PostgreSQL SQL.
- JPA and direct `JdbcTemplate` domain persistence are not production application persistence paths.
- Current clean pre-release baseline is V1-V8.
- Before first production deployment, the baseline may be intentionally reorganized and disposable development/test databases recreated after checksum/history changes.
- At first production deployment, freeze applied migrations; future schema changes are append-only from V9+.
- Schema presence is not feature evidence. In particular, nullable VisualBeat timing columns do not prove current analysis/reconciliation populates them.

## Change discipline

- Preserve existing user changes in the worktree.
- Keep feature ownership clear: backend domain must not import provider SDKs; adapters belong in infrastructure/integration layers; Python worker owns asynchronous AI/media runtime dependencies; Electron main owns native Desktop execution.
- Add/update tests with behavior changes. Prefer deterministic fake providers in ordinary tests; never report fake provider success as production health.
- Update relevant current Markdown for behavior/boundary changes and add a new ADR when a cross-cutting architectural decision changes.
- Check `documentation/decisions/README.md` before relying on older ADR scope.
- Check `docs/superpowers/plans/README.md` before executing a plan.
- Run narrow relevant checks during iteration, then the repository verification commands from `CONTRIBUTING.md`.
- Runtime/application changes beyond the audited documentation checkpoint require docs resync; `scripts/check-docs-checkpoint.py` enforces this.

## Mandatory Desktop UI Verification

For any task that changes Desktop UI, styling, layout, routing, modal, form, interaction, responsive behavior or renderer data presentation:

1. Start or reuse the Electron/Vite development environment.
2. Launch the available Desktop/browser automation environment when supported.
3. Navigate to every affected screen.
4. Execute the actual user flow affected by the change.
5. Inspect console errors, failed API requests, unexpected mock/fake data usage, layout/overflow issues and loading/error/empty states.
6. Capture screenshot evidence after implementation when the environment supports it.
7. Review rendered UI against current implementation-facing documentation and approved design references.
8. If runtime verification fails, fix the implementation and repeat verification.

### Completion gate

Never mark a Desktop UI task DONE based only on source review, lint, typecheck, unit tests or build success. When runtime UI automation is unavailable, report runtime verification as blocked rather than claiming visual verification occurred.

For non-UI work, apply the same evidence principle: do not claim tests/checks/runtime behavior that did not actually execute.
