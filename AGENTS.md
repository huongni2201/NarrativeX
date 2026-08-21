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
- Runtime frontend code uses real APIs only. Mock data is limited to isolated tests and Storybook fixtures and must never be selected by application runtime configuration.
- User identity comes from Spring Security `SecurityContextHolder`; application APIs must not accept identity through `X-User-Id` or equivalent client-controlled headers.
- Browser authentication currently uses Spring Security server-managed sessions + CSRF for password and Google OIDC flows. Spring Session persists the opaque `NX_SESSION` in Redis; JWT/access/refresh tokens are not part of the current runtime contract.
- Test authentication credentials are supplied out-of-band through `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`; never store or print their values in repository guidance, source, logs, or test artifacts. See `.agents/rules/test-credentials.md`.
- Frontend styling MUST use centralized design tokens and semantic CSS variables defined in global CSS (`globals.css` / `tailwind.config.ts`). Ad-hoc, hardcoded hex values in component JSX/TSX are strictly prohibited; define new semantic tokens in `globals.css` if a needed design token does not exist.
- Playwright testing and browser verification MUST avoid arbitrary sleep/delays (`waitForTimeout`), relying on auto-waiting locators, web-first assertions, and event-driven waits to minimize step latency. See `.agents/rules/playwright-testing.md`.

## Change discipline

- Preserve existing user changes in the worktree.
- Keep feature ownership clear: backend domain must not import provider SDKs; adapters belong in infrastructure/integration layers; the Python worker owns AI/media runtime dependencies.
- Add or update tests with behavior changes. Prefer deterministic fake providers in tests; never report fake provider success as production health.
- Update the relevant Markdown document and an ADR when a cross-cutting architectural decision changes.
- Run the narrowest relevant checks locally, then the repository verification commands documented in `CONTRIBUTING.md`.

## Mandatory Frontend Verification

For ANY task that changes frontend UI, styling, layout, routing,
modal, form, interaction, responsive behavior, or frontend data rendering:

1. Start or reuse the frontend development server.
2. Launch the available browser automation environment.
3. If the browser was closed or its session was lost, relaunch it automatically.
4. Navigate to every affected screen.
5. Execute the actual user flow affected by the change.
6. Inspect:
   - browser console errors
   - failed network/API requests
   - unexpected mock/fake data usage
   - layout/overflow issues
   - loading/error/empty states
7. Capture screenshot evidence after implementation.
8. When relevant, capture before/after screenshots.
9. Review the rendered UI visually against current implementation-facing documentation and approved design references.
10. If verification fails, fix the implementation and repeat browser verification.

### Completion Gate

NEVER mark a frontend task as DONE based only on:
- source-code review
- lint
- typecheck
- unit tests
- build success

A frontend UI task is DONE only when:
- browser verification has been executed;
- the affected user flow has been tested;
- no blocking console/network errors remain;
- screenshot evidence exists.

If browser automation is unavailable or cannot be launched,
report the task as `IMPLEMENTED — UI VERIFICATION BLOCKED`,
not `DONE`.
