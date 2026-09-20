# NarrativeX repository guidance

## Source of truth

The repository itself is the current implementation source of truth. Keep architecture decisions in `documentation/decisions/`, implementation-facing architecture and codebase guidance under `documentation/`, and update those documents whenever behavior or boundaries change. Do not reference the removed `NARRATIVEX_PROJECT_SPEC_V1_7.md`; it was intentionally retired after the implementation diverged from that snapshot.

## Read by task

- Start with [current status](documentation/CURRENT_STATUS.md) and the [documentation map](documentation/README.md). Code, migrations and tests establish implementation facts; accepted ADRs establish direction. Report disagreement instead of assuming a migration is complete.
- For backend/compute changes, read ADR-0018, ADR-0019, ADR-0021, ADR-0025 and `documentation/COMPUTE_PROTOCOL.md`.
- For identity, ownership or runtime-limit changes, read ADR-0020. Earlier account/session/quota rules are superseded in that scope.
- For schema changes, read `documentation/architecture/DATABASE.md`.
- For Desktop styling, read `.agents/rules/frontend-styling.md`; for browser verification, read `.agents/rules/playwright-testing.md` and the completion gate below.
- Run checks according to `CONTRIBUTING.md`.

## Domain and execution rules

- Keep Spring Boot a modular monolith and the authority for business state, admission, durable jobs, leases and artifact metadata in PostgreSQL. Add a broker, cache or business microservice only with measured need and an ADR.
- Follow ADR-0020: one local installation, Project as the business boundary, no synthetic user/account/session identity. Provider secrets and machine execution credentials remain separate runtime concerns.
- Character remains a reusable identity with ProjectCharacter participation and immutable CharacterVersion snapshots. Appearance/outfit changes do not create a new Character. Resolve only participating characters for Scene/StoryBeat/VisualBeat context.
- Treat story text, prompts, references and provider output as untrusted. Validate schemas and enforce prompt-injection/media-safety boundaries. Real-person references require explicit consent, restricted retention and deletion handling; do not add blanket story-rights checkboxes.
- Plan visuals from duration, semantic complexity and reuse/delta. Preserve source provenance and narration as the production master clock; provisional timing cannot make a render ready.
- Preserve locked character versions, approved assets, provider snapshots and render snapshots.
- Persist operation/submission intent before external I/O. Ambiguous outcomes remain UNKNOWN until reconciled; never blind-resubmit.
- Expensive work requires backend admission, OperationPlan where applicable, runtime capacity limits, idempotency and diagnostic usage attribution. Do not restore monetary billing or per-user entitlements retired by ADR-0020.
- Keep backend domain free of provider SDKs. GPU execution adapters own provider/media dependencies; `app/generation-service` must not access the business database or orchestrate business jobs.


## Desktop and storage boundaries

- `app/desktop` is the only editor. Renderer owns UI/routing/editor state and uses real APIs; deterministic fake providers/data belong only in isolated tests/fixtures.
- Electron main owns filesystem/process access, protected provider/device credentials, backend transport and final FFmpeg/ffprobe execution through a narrow typed preload bridge.
- Project bytes are local-first. Backend identities use stable IDs/checksums and opaque project-relative artifact keys, never absolute machine paths. Final video persistence is metadata-only.
- Use centralized design tokens and semantic CSS variables for renderer styling.
- Treat Compose and environment templates as migration-sensitive: verify their current contents before claiming deployment readiness. See `documentation/CURRENT_STATUS.md` for known drift.

## Change discipline

- Preserve existing worktree changes; inspect current files before editing. Do not reset or stage unrelated work.
- Add or update tests for behavior changes. Never report fake-provider success as production health.
- Update the smallest relevant current document. Cross-cutting boundary changes require an ADR; synchronizing docs with an existing accepted ADR does not require a duplicate decision.
- Keep IMPLEMENTED, PARTIAL, TARGET and DEFERRED explicit. An accepted decision is not proof of completed implementation.
- For docs-only edits, check links, migration inventory and docs drift. Runtime code changes require the relevant checks and the full gate before merge; report unavailable or failing checks honestly.

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
