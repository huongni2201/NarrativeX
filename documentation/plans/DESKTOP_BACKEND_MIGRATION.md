# NarrativeX Desktop Backend Migration

This branch migrates project rendering from cloud-only execution toward a desktop-first execution model without breaking the current cloud fallback.

## Target boundary

- Spring Backend remains the control plane and source of truth.
- ProductionTimeline and immutable render snapshots stay on the backend.
- `RENDER_PROJECT` gains an execution target: `CLOUD` or `LOCAL_DEVICE`.
- A local device must be paired, online, and advertise `PROJECT_RENDER` before it can be assigned.
- Desktop claims only jobs assigned to its device token.
- Python project-render worker claims only `CLOUD` jobs.
- During migration, existing web calls default to `CLOUD` so current behavior remains compatible.
- Once the desktop executor is proven, `LOCAL_DEVICE` becomes the default and the Python project-render worker can be retired.

## Migration slices

1. **Backend execution routing**
   - execution target + assigned device on immutable project render snapshot
   - device validation/capability check
   - local claim/heartbeat/progress/complete/fail APIs
   - cloud worker excludes local jobs

2. **Desktop executor**
   - move Electron foundation to `app/desktop`
   - device authentication
   - claim local jobs
   - download immutable snapshot inputs
   - local cache + FFmpeg segmented render
   - report progress/result

3. **Desktop-first default**
   - Production UI requests `LOCAL_DEVICE`
   - cloud fallback becomes opt-in
   - operational telemetry/recovery

4. **Retire cloud project renderer**
   - remove Python `ProjectRenderWorker`
   - remove `CLOUD` path for project render when no longer needed

This document intentionally does not define desktop UI implementation; that work is owned separately.
