# NarrativeX Source of Truth V1.10

## Canonical baseline

The canonical baseline for the current repository state is:

- Version: `V1.10`
- Repository snapshot: `main@193e602c5f1671ad3280f8952206535aa8f29bb4`
- Effective date: `19/08/2026`

The complete specification should live in:

```text
documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md
```

## V1.10 important updates

- Project Overview API/read model is implemented.
- Chapter import (`txt`, `docx`, `pdf`) is implemented.
- Storyboard/VisualBeat read and review flows are implemented foundations.
- Worker bounded concurrency is implemented.
- Job History, Quota and Notification read surfaces exist.
- Flyway development baseline is consolidated around V1/V2/V3.

## Current known gaps

The following are intentionally not marked complete:

- Durable ProviderOperation submit/reconcile lifecycle.
- Real cost/quota/admission enforcement before billable provider execution.
- AI Location materialization and Scene -> Character/Location continuity relations.
- Non-destructive approved storyboard reset/versioning workflow.
- Full image/TTS/video/render/export pipeline.

## Documentation rule

Derived documentation files describe implementation views. They must link back to this baseline and must not redefine product invariants independently.
