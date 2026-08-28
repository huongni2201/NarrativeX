# NarrativeX implementation plan index

Implementation plans in this directory are **execution aids, not current-state architecture documentation**. Always check the status in this index before using a plan.

## Status vocabulary

- **ACTIVE** — approved implementation work remains and the plan is still the intended execution path.
- **COMPLETED** — the plan has been implemented and verified; current behavior must be described in `documentation/` and `TRACEABILITY.md` instead of inferred from the plan.
- **SUPERSEDED** — another plan/ADR/current design replaced it before completion; keep only when useful as execution history.

A plan may describe desired interfaces, files or tests that do not exist yet. Never turn plan text into an `IMPLEMENTED` claim without verifying current code, migrations and tests.

## Plan ledger

| Plan | Status | Audited code baseline | Purpose |
| --- | --- | --- | --- |
| [`2026-08-28-draft-visual-beat-preview-audio-timeline.md`](./2026-08-28-draft-visual-beat-preview-audio-timeline.md) | ACTIVE | `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e` | Add deterministic Visual Beat source spans, reconcile them to narration timing, expose draft storyboard beats safely and drive Desktop draft preview from real narration audio. |

## Completion workflow

When an ACTIVE plan is completed:

1. run its focused tests and repository quality gates;
2. update `documentation/TRACEABILITY.md` from TARGET/PARTIAL to the verified status;
3. update affected source-of-truth/product/workflow/codebase docs to AS-IS behavior;
4. advance the documented implementation checkpoint to the audited code commit;
5. change the plan status here to COMPLETED;
6. keep obsolete migration/report docs out of current documentation; Git history is the archive.

When a plan is replaced before completion, mark it SUPERSEDED here and point to the replacing plan/ADR rather than leaving two apparently active implementation paths.
