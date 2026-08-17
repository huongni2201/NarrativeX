# NarrativeX repository guidance

## Source of truth

The canonical product and architecture baseline is the repository-local `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_7.md` (NarrativeX v1.7, 17/08/2026). Markdown under `documentation/` is the maintainable implementation-facing summary of that specification; local Downloads copies are not authoritative.

## Non-negotiable domain rules

- PostgreSQL is authoritative for business state; Redis is only a queue/cache/progress accelerator.
- Keep the Spring Boot application modular-monolith shaped. Do not introduce microservices without a measured bottleneck and an explicit ADR.
- Story text, prompts, references, and provider output are untrusted data. Enforce rights/consent, moderation, prompt-injection boundaries, schema validation, and output review.
- Never assume 60 minutes, 2,000 words, one sentence per image, or a fixed image count. Visual planning is duration + semantic complexity + reuse/delta based.
- Character is a reusable User/Workspace-owned identity, never a Project-owned duplicate.
- Project participation is modeled through ProjectCharacter.
- Character identity is versioned through immutable CharacterVersion snapshots.
- Outfit/age/hairstyle/injury/story-state changes belong to CharacterAppearance/OutfitVersion, not a new Character.
- Scene/VisualBeat AI context must resolve participating characters only. Locked `CharacterVersion`, approved assets, render versions, and provider snapshots are immutable.
- Persist a provider reservation before an external submission. Ambiguous outcomes become `UNKNOWN` and must reconcile before retry; never blind-resubmit.
- Expensive operations require an `OperationPlan`, cost estimate/reservation, account abuse checks, entitlement checks, and usage attribution.
- Server-side entitlement is authoritative for watermark, quality, export, concurrency, and quota rules.
- Real-person references require explicit consent, tenant isolation, restricted retention, and deletion handling.

## Change discipline

- Preserve existing user changes in the worktree.
- Keep module ownership clear: backend domain must not import provider SDKs; adapters belong in integration layers; the Python worker owns AI/media runtime dependencies.
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
9. Review the rendered UI visually against the current source of truth,
   approved reference image, and design specification.
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