# Repository Deep Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove proven-unused/generated repository residue, eliminate stale post-migration documentation, and strengthen drift guards without changing NarrativeX runtime behavior or public contracts.

**Architecture:** Treat current `main` code, `AGENTS.md`, accepted ADRs, and implementation-facing `documentation/` as authority. This cleanup is behavior-preserving: delete only artifacts or compatibility residue with no production caller, keep R2 only where the current voice/provider transport explicitly requires it, and do not reintroduce a Python/server final-render path superseded by Desktop `LOCAL_DEVICE` rendering.

**Tech Stack:** Spring Boot/Java, Python 3.12 worker, Electron/React/TypeScript Desktop, PostgreSQL, PowerShell repository verification.

**Spec:** `documentation/decisions/ADR-0012-desktop-local-first-media-and-render-execution.md`

## Global Constraints

- Preserve runtime behavior, API contracts, database schema and Desktop UI behavior.
- `app/desktop` remains the only editor client.
- Final project render execution remains Electron-main-only under backend assignment/lease.
- R2 remains available only for current generated-media/voice/provider transport boundaries; it is not authoritative for Desktop project or final-video bytes.
- Remove runtime code only when repository callers/tests prove it unused.
- Do not modify historical ADR intent; update current-state docs and guardrails instead.
- Run the narrowest relevant checks, then the repository verification gate when an executable checkout is available.

---

### Task 1: Harden current-documentation drift coverage

**Files:**
- Modify: `scripts/check-docs-drift.py`
- Test/verify: `python scripts/check-docs-drift.py`

**Interfaces:**
- Consumes: `CURRENT_FILES`, existing forbidden-pattern checks.
- Produces: coverage for `app/ai-worker/README.md` so removed Google Drive/server-render assumptions cannot silently return.

- [ ] **Step 1: Register `app/ai-worker/README.md` in `CURRENT_FILES`**

Add the worker README beside the existing Desktop README registration. With the current stale README this makes the checker fail on the already-forbidden Google Drive/final-render language.

- [ ] **Step 2: Run the checker to verify RED**

Run:

```bash
python scripts/check-docs-drift.py
```

Expected before Task 3: FAIL because the worker README still describes removed Google Drive/server final-render behavior.

- [ ] **Step 3: Commit the guard**

```bash
git add scripts/check-docs-drift.py
git commit -m "test(docs): cover ai worker readme drift"
```

### Task 2: Remove generated VieNeu preview artifacts from source control

**Files:**
- Modify: `.gitignore`
- Delete: `app/ai-worker/artifacts/vieneu-previews/manifest.json`
- Delete: `app/ai-worker/artifacts/vieneu-previews/*.wav`
- Keep: `app/ai-worker/scripts/generate_vieneu_previews.py`

**Interfaces:**
- Consumes: the existing maintenance script, which generates preview upload artifacts on demand.
- Produces: a source tree that no longer tracks regenerated audio binaries while preserving the maintenance workflow.

- [ ] **Step 1: Confirm no production caller depends on the artifact directory**

Search for both `vieneu-previews` and `generate_vieneu_previews`; only the maintenance generator/default output path may reference the directory.

- [ ] **Step 2: Ignore generated worker artifacts**

Add:

```gitignore
# Generated AI-worker maintenance/upload artifacts
app/ai-worker/artifacts/
```

- [ ] **Step 3: Delete tracked generated preview files**

Remove the generated `manifest.json` and WAV outputs under `app/ai-worker/artifacts/vieneu-previews/`. Do not delete the generator script.

- [ ] **Step 4: Commit artifact cleanup**

```bash
git add .gitignore app/ai-worker/artifacts
git commit -m "chore(worker): stop tracking generated voice previews"
```

### Task 3: Reconcile worker and contributor docs with current runtime

**Files:**
- Modify: `app/ai-worker/README.md`
- Modify: `CONTRIBUTING.md`
- Reference: `documentation/codebase/AI_WORKER_CODEBASE.md`
- Reference: `documentation/decisions/ADR-0012-desktop-local-first-media-and-render-execution.md`
- Reference: `docker-compose.yml`

**Interfaces:**
- Consumes: current worker roles (`analysis`, `narration`, `media-validation`, `image-generation`), Desktop local-first render boundary, and existing R2 voice/provider transport.
- Produces: current-state operational docs with no removed cloud-render/Google Drive path.

- [ ] **Step 1: Remove the nonexistent render-worker role from the worker README**

Delete `RENDER_WORKER_CONCURRENCY`, cloud/server FFmpeg final-render claims, the Google Drive final-MP4 line, and the obsolete Render-role section. State explicitly that final project rendering belongs to Electron main.

- [ ] **Step 2: Tighten storage wording**

Document these current boundaries:

```text
Desktop project/final bytes -> Electron ProjectStorage
shared server-side generated-media handoff -> configured project-media local root where applicable
R2 -> explicitly routed generated-media/voice/provider transport only
GCS -> temporary Vertex batch staging only
worker scratch -> ephemeral
```

Do not describe R2 as general Desktop project storage.

- [ ] **Step 3: Correct the broad R2 sentence in `CONTRIBUTING.md`**

Replace the implication that all AI-generated image/narration bytes normally live in R2 with wording consistent with ADR-0012: remote transport may use R2 when required, while accepted project bytes are materialized into local-first project storage before final rendering.

- [ ] **Step 4: Run the documentation drift checker to verify GREEN**

Run:

```bash
python scripts/check-docs-drift.py
```

Expected: PASS.

- [ ] **Step 5: Commit documentation reconciliation**

```bash
git add app/ai-worker/README.md CONTRIBUTING.md
git commit -m "docs: align worker storage and render boundaries"
```

### Task 4: Re-audit runtime dead-code candidates without speculative deletion

**Files:**
- Inspect: `app/backend-service/src/main/**`
- Inspect: `app/ai-worker/src/**`
- Inspect: `app/desktop/src/**`
- Inspect: existing cleanup/boundary tests

**Interfaces:**
- Consumes: repository code search, imports/callers, source-level legacy guards, tests.
- Produces: either a proven-unused deletion with a regression guard, or an explicit no-delete result for ambiguous candidates.

- [ ] **Step 1: Search for deprecated/legacy/TODO/unused candidates and their exact symbols**

Do not equate a `TODO`, migration compatibility branch, mapper fallback, or test fixture with dead code.

- [ ] **Step 2: For each deletion candidate, identify the production change that a regression test would detect**

If no reliable guard can be written or callers cannot be disproven, leave the code in place.

- [ ] **Step 3: Add a failing characterization/absence guard before deleting any proven runtime residue**

Use the module's existing test style. For Desktop compatibility residue, extend `app/desktop/test/legacy-cleanup.test.mjs`; for backend/worker behavior, use module-native tests.

- [ ] **Step 4: Delete only after RED is observed, then run the focused test to GREEN**

No speculative runtime-code deletion is allowed in this cleanup.

### Task 5: Verification and review

**Files:** no new runtime files.

**Interfaces:**
- Consumes: all cleanup changes.
- Produces: evidence that cleanup is behavior-preserving.

- [ ] **Step 1: Run static/doc checks**

```bash
python scripts/check-docs-drift.py
python scripts/check-secrets.py
```

- [ ] **Step 2: Run relevant worker checks if worker source changed**

```bash
cd app/ai-worker
pytest
ruff check .
ruff format --check .
mypy src tests
```

- [ ] **Step 3: Run relevant backend/Desktop checks if runtime source changed**

```text
app/backend-service: mvnw verify
app/desktop: npm test && npm run type-check && npm run build
```

- [ ] **Step 4: Run the full repository gate in a capable checkout**

```powershell
pwsh -File scripts/verify-local.ps1
```

- [ ] **Step 5: Compare the cleanup branch against latest `main` and document any verification blocked by environment limitations**
