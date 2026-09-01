# Backend Verify and Audit Cleanup Plan

## Goal

Restore release confidence on the current `main` baseline with minimal, regression-tested changes and no unrelated refactors.

## Scope

1. Lock the AI-worker public contract boundaries with regression tests.
2. Remove the provider-inaccurate `source_text` token estimate and keep the declared 500,000-character schema limit as the canonical input bound.
3. Ensure the legacy `repository.claims` import seam resolves to the public repository facade so claim fencing and analysis-preference hydration cannot be bypassed.
4. Trigger CI on the repair branch and verify AI worker, Desktop, repository gates, and Backend Verify independently.
5. If Backend Verify remains red, capture the failing Maven test reports/diagnostics first, then add a regression test and make the smallest confirmed backend fix.
6. Record Desktop Electron runtime smoke verification separately from automated checks; do not claim runtime verification if the available environment cannot execute it.

## Completion criteria

- AI worker tests, Ruff, and mypy pass.
- Repository gates pass.
- Desktop automated checks pass.
- Backend `./mvnw --no-transfer-progress verify` passes.
- Any remaining runtime-only verification gap is stated explicitly rather than treated as complete.
