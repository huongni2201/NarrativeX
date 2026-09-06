# Gemini Web Visual Consistency Evaluation — 2026-09-07

## Scope

This report records the deterministic implementation and verification status for the parallel Gemini Web Storyboard consistency work defined in `documentation/plans/2026-09-06-parallel-gemini-visual-consistency-fix.md`.

It deliberately separates input/transport correctness from provider visual quality. Code/tests may prove that the same pinned source/canon/continuity/reference inputs reach the intended attempt and output mapping; they cannot prove that Gemini will render two images with acceptable artistic consistency.

## Implemented deterministic controls

### Timeline/canon resolution

- Character text and reference assets resolve from the same pinned CharacterVersion when one is configured.
- Beat participant rows scope character/reference context; legacy/manual beats can still fall back to scene cast.
- Character appearance projection no longer selects the latest project appearance across chapters. With current continuity it selects only the matching continuity timeline; without continuity it falls back only to `chapter:<chapterId>` legacy appearance.
- Structured appearance fields are merged field-by-field in prompt output; a generic `appearancePrompt` does not hide wardrobe, injury, hairstyle or age.
- Pinned beat continuity is explicitly authoritative over generic canon state.
- Required reference count above the supported three-image budget is blocking rather than silently truncated.

### Immutable Storyboard generation inputs

- Additive Flyway `V14__storyboard_generation_snapshots.sql` persists immutable batch and beat snapshot metadata.
- Prepare runs in `REPEATABLE_READ` and uses existing project/chapter ownership authorization.
- Batch provenance pins source hash, storyboard revision, continuity plan/report revision, style/provider policy versions, exact prompt, character snapshot, ordered reference metadata/checksums and input fingerprints.
- Idempotency fingerprint includes the requested beat scope, including requests whose beats are all blocked before snapshot creation.
- Stale evaluation checks source/storyboard/continuity/policy and current beat fingerprints, catching canon/appearance/reference/row-version changes that do not advance chapter source hash.

### Desktop transport and attempts

- Renderer generation consumes prepared beat snapshots rather than live per-slot prompt composition.
- Reference materialization deduplicates by project + asset + expected checksum.
- Electron main hashes resolved local reference bytes immediately before upload.
- Storyboard IPC requires attempt/batch/snapshot/fingerprint and pinned policy provenance.
- Local queue state persists a conservative `SUBMITTING` attempt before external IPC dispatch. Restart converts ambiguous submissions to `UNKNOWN`.
- Electron main keeps a bounded terminal-history attempt journal while never pruning unresolved `PREPARED`, `SUBMITTING` or `UNKNOWN` attempts.
- Resume reconciles ambiguous attempts and does not blind-resubmit them through another browser/account.
- Late output after a source/canon/continuity change may be retained as a local asset for review but is not attached to the newer beat revision.
- New generated preview attachment resets Visual Beat review state to `NEEDS_REVIEW`.

## Deterministic regression coverage added/updated

Backend:

- appearance prompt does not mask structured wardrobe/injury/hairstyle/age;
- generated preview resets review state;
- prepare same-key/same-scope reuse;
- same-key/different blocked requested scope conflict;
- content-fingerprint stale detection even when source/storyboard IDs remain stable;
- expected storyboard revision mismatch admission.

Desktop:

- schema-v2 queue provenance and legacy queue migration;
- conservative restart transition `SUBMITTING -> UNKNOWN`;
- unresolved attempt cannot be silently replaced; explicit failed attempt may retry;
- exact prepared prompt/reference/provenance transport;
- checksum failure before browser submit;
- blocking/stale batch pre-submit rejection;
- output provenance mismatch rejection;
- late stale output retained without attach;
- checksum-aware concurrent materialization;
- attempt journal persistence across restart.

## Verification status

### Automated repository gate

GitHub Actions run `34065793535` was triggered while implementation was in progress. All jobs terminated within approximately four seconds without recorded steps, and job-log retrieval returned no executable test output. This is treated as a workflow/runner startup failure, not evidence that backend/Desktop tests passed or failed.

A fresh successful `backend ./mvnw verify`, Desktop `npm run check`, repository gates and AI-worker checks are still required before merge. No check is marked PASS solely because source code or tests exist.

### Desktop runtime

Not verified in this implementation session. Required runtime evidence:

1. launch the Electron/Vite Desktop application;
2. prepare and generate one beat;
3. run a bounded-parallel Generate All batch;
4. inspect Prompt & details and confirm submitted snapshot provenance differs from current draft after a later edit;
5. edit source/canon while work is in flight and confirm pending work becomes stale;
6. confirm a late output is retained but not attached;
7. restart/pause/resume around an ambiguous attempt and confirm no blind duplicate submit;
8. capture runtime screenshots and inspect console/network errors.

Until this is executed, UI/runtime acceptance is **BLOCKED**, not PASS.

### Real-image provider quality

Not measured in this implementation session. A production-like comparison must use the same story fixture and record actual submitted prompt, reference checksums, model/preset, batch/snapshot fingerprints and output mapping.

Recommended minimum fixture:

- two recurring characters in one room across multiple scenes;
- stable outfit for several beats;
- one source-grounded outfit transition;
- one flashback on a distinct timeline;
- one single-character beat;
- at least one bounded-parallel run with completion order different from beat order.

Compare identity, outfit timing, cast leakage, location continuity, style drift and duplicate/mixed outputs.

## T6 visual-anchor decision

**DEFERRED.** The opening condition has not been demonstrated because the required post-T1–T4 real-image benchmark has not yet been run. No extra anchor-generation cost/review lifecycle is introduced merely to complete a checklist.

Open T6 only if the measured benchmark shows material visual drift while submitted input/transport invariants are correct. If opened, evaluate with/without anchor under the same prompt/reference budget and record latency, review steps, cast leakage and copy-pose behavior.

## Rollback and legacy notes

- `V14` is additive; do not rewrite already-applied migrations.
- Existing chapter media is not automatically regenerated or deleted.
- Legacy/missing-continuity chapters can still prepare with a warning; if a current continuity plan exists but a requested beat lacks its required state, that beat is blocking.
- Legacy local Gemini queues are restored paused and require prepare for pending work. Existing generated/approved assets remain intact.
- Backend style/provider policy versions are pinned into every new snapshot. A rollback may stop admission of new batches under a newer policy while historical batches remain readable for provenance/reconciliation.
- Browser attempt journal state is execution reconciliation metadata only and must not become a second business authority.

## Release conclusion

The deterministic implementation is intended to remove mixed-revision, wrong-reference, stale-attach and blind-resubmit classes of errors. Release is **not yet declared DONE** because successful full repository CI, Desktop runtime evidence and the real-image quality benchmark are still required by the plan.
