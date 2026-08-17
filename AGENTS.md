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
