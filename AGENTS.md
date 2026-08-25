# NarrativeX repository guidance

## Source of truth

The repository itself is the current implementation source of truth. Keep architecture decisions in `documentation/decisions/`, implementation-facing architecture and codebase guidance under `documentation/`, and update those documents whenever behavior or boundaries change. Do not reference the removed `NARRATIVEX_PROJECT_SPEC_V1_7.md`; it was intentionally retired after the implementation diverged from that snapshot.

## Non-negotiable domain rules

- PostgreSQL is authoritative for durable business state. Redis is non-authoritative infrastructure used for queue/delivery hints, cache, progress/scheduling, transient abuse-control counters, and server-managed HTTP session storage. Queue/progress state must be reconstructable where designed; Redis session loss may sign users out but must never lose durable business state.
- Keep the Spring Boot application modular-monolith shaped. Do not introduce microservices without a measured bottleneck and an explicit ADR.
- Story text, prompts, references, and provider output are untrusted data. Enforce moderation, prompt-injection boundaries, schema validation, and output review. Do not require a blanket per-story copyright/rights attestation checkbox. Rights/consent gates apply only where a concrete product or legal requirement exists; real-person references still require explicit consent.
- Never assume 60 minutes, 2,000 words, one sentence per image, or a fixed image count. Visual planning is duration + semantic complexity + reuse/delta based.
- Character is a reusable User/Workspace-owned identity, never a Project-owned duplicate.
- Project participation is modeled through ProjectCharacter.
- Character identity is versioned through immutable CharacterVersion snapshots.
- Outfit/age/hairstyle/injury/story-state changes belong to CharacterAppearance/OutfitVersion, not a new Character.
- Scene/VisualBeat AI context must resolve participating characters only. Locked `CharacterVersion`, approved assets, render versions, and provider snapshots are immutable.
- Persist provider reservation/outbox state before external submission. Ambiguous outcomes become `UNKNOWN` and must reconcile before retry; never blind-resubmit.
- Expensive operations require an `OperationPlan`, cost estimate/reservation, account abuse checks, entitlement checks, idempotency, and usage attribution.
- Server-side entitlement is authoritative for watermark, quality, export, concurrency, and quota rules.
- Real-person references require explicit consent, tenant isolation, restricted retention, and deletion handling.
- `app/desktop` is the only editor client. Do not recreate `app/frontend-web` or add a parallel browser editor without an explicit ADR.
- Desktop renderer code uses real APIs only. Mock data is limited to isolated tests/fixtures and must never be selected by application runtime configuration.
- User identity comes from Spring Security `SecurityContextHolder`; application APIs must not accept identity through `X-User-Id` or equivalent client-controlled headers.
- End-user authentication is Google OAuth only. Desktop starts OAuth in the system browser, receives a one-time handoff through `narrativex://auth/callback`, then establishes a server-managed `NX_SESSION`. Google access/refresh tokens must never enter Electron.
- Local device tokens are separate machine credentials for heartbeat/render APIs and must not be confused with user OAuth/session credentials.
- Frontend/renderer styling MUST use centralized design tokens and semantic CSS variables. Ad-hoc hardcoded visual values should be avoided when an existing semantic token is available.

## Runtime and deployment boundaries

- Electron renderer owns UI/routing/editor state only; unrestricted Node.js/process/filesystem access stays out of the renderer.
- Electron main owns native filesystem access, protected credentials, system-browser/deep-link handling, backend session transport and local FFmpeg/ffprobe execution.
- Desktop project bytes are local-first and represented to the backend through stable IDs/checksums plus opaque project-relative artifact keys, never absolute local filesystem paths.
- Production Compose has no web frontend and no Caddy service.
- Cloudflare Tunnel is optional infrastructure for self-hosted HTTPS ingress and, when used, routes directly to `http://backend:8080`. If deployment already provides HTTPS ingress, `cloudflared` is not required.

## Change discipline

- Preserve existing user changes in the worktree.
- Keep feature ownership clear: backend domain must not import provider SDKs; adapters belong in infrastructure/integration layers; the Python worker owns AI/media runtime dependencies.
- Add or update tests with behavior changes. Prefer deterministic fake providers in tests; never report fake provider success as production health.
- Update the relevant Markdown document and an ADR when a cross-cutting architectural decision changes.
- Run the narrowest relevant checks locally, then the repository verification commands documented in `CONTRIBUTING.md`.

## Mandatory Desktop UI Verification

For any task that changes Desktop UI, styling, layout, routing, modal, form, interaction, responsive behavior, or renderer data presentation:

1. Start or reuse the Electron/Vite development environment.
2. Launch the available Desktop/browser automation environment when supported.
3. Navigate to every affected screen.
4. Execute the actual user flow affected by the change.
5. Inspect console errors, failed API requests, unexpected mock/fake data usage, layout/overflow issues, and loading/error/empty states.
6. Capture screenshot evidence after implementation when the environment supports it.
7. Review the rendered UI against current implementation-facing documentation and approved design references.
8. If runtime verification fails, fix the implementation and repeat verification.

### Completion gate

Never mark a Desktop UI task as DONE based only on source review, lint, typecheck, unit tests or build success. When runtime UI automation is unavailable, report the implementation as runtime-verification blocked rather than claiming visual verification occurred.
