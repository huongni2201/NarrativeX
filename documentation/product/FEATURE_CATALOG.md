# NarrativeX — Current Feature Catalog (V1.12)

Current code, Flyway migrations and automated tests decide factual AS-IS claims. Accepted ADRs refine cross-cutting architecture. Roadmap intent must not be presented as implemented runtime.

| Feature | Status | Current direction |
|---|---|---|
| Single-user local-first workspace | IMPLEMENTED | Direct workspace boot, Project-level boundary (ADR-0030) |
| Authentication/account runtime | REMOVED | No User, Account, Session, OAuth or login gates |
| Per-user quota/entitlement | REMOVED | Monetary billing, user credits and per-user quotas retired |
| Runtime capacity limits | IMPLEMENTED foundation | System capacity reservations with terminal settlement |
| Project/Chapter authoring | IMPLEMENTED foundation | backend-authoritative persistence + Desktop UI |
| Chapter Analyze | IMPLEMENTED | durable job/provider lifecycle |
| Character/Location continuity | IMPLEMENTED foundation | richer review/reference locking remains partial |
| Scene / VisualBeat storyboard | IMPLEMENTED foundation | review + generation preparation |
| `IMAGE` visual intent | IMPLEMENTED | backend/generation-service image workflows |
| `VIDEO` visual intent | IMPLEMENTED foundation | retained in Analyze Chapter for web/browser video-generation workflows |
| Python/Wan video provider | REMOVED | do not restore as implicit VIDEO/final-render fallback |
| VoiceStudio narration | IMPLEMENTED foundation | segmented headless TTS persists a project-local WAV master |
| User-provided narration | IMPLEMENTED foundation | native import + logical audio clock |
| Compute Protocol v1 | IMPLEMENTED | JSON Schema contracts in `contracts/compute/v1/` |
| Generation-service scaffold | IMPLEMENTED foundation | Hexagonal FastAPI execution plane (`app/generation-service`) |
| Backend compute dispatch | IMPLEMENTED foundation | control plane task submission, artifact verification, durable mapping & callbacks |
| Narration cutover | IMPLEMENTED foundation | VoiceStudio synthesis + WhisperX forced alignment through generation-service |
| Image cutover | IMPLEMENTED foundation | ComfyUI/RealVisXL execution with backend-owned artifact materialization |
| Legacy compute runtime removal | IMPLEMENTED | PostgreSQL-polling runtime, CI job and active configuration removed |
| Native local media import | IMPLEMENTED foundation | image/audio/video via Electron main |
| Persisted beat media selection | IMPLEMENTED foundation | effective image/video production source |
| Mixed image/video timeline | IMPLEMENTED foundation | video trim/fill semantics remain richer than image controls |
| Auto Edit planning | IMPLEMENTED foundation | narration-aware local render overrides |
| Render subtitle track | IMPLEMENTED foundation | immutable narration/alignment snapshot → local SRT/mux |
| Desktop local workspace | IMPLEMENTED foundation | ProjectStorage/ProjectCatalog + manifest integrity |
| Backup/restore/archive-copy | IMPLEMENTED foundation | local snapshots and safe replacement |
| Backend-assigned local render | IMPLEMENTED foundation | paired device + claim/lease |
| Desktop FFmpeg project render | IMPLEMENTED foundation | single current final-render executor |
| Render journal/cache | IMPLEMENTED foundation | recovery/performance foundation |
| Final MP4 local storage | IMPLEMENTED | backend stores metadata only |
| Direct final playback/export | IMPLEMENTED foundation | local artifact, no backend byte proxy |
| Cloud/server final render | REMOVED | no fallback executor |
| Server-side Chapter render pipeline | REMOVED | project render is the supported final-render path |
| Generated project media via R2 | REMOVED | images/narration are project-local |
| Account-scoped voice storage in R2 | REMOVED | voice assets transition to local storage (`PROJECT` / `GLOBAL_LOCAL`) |
| MyBatis production persistence | IMPLEMENTED | explicit PostgreSQL SQL |
| Flyway clean pre-production baseline | IMPLEMENTED | clean DB applies squashed V1–V7 final schema directly |
| Provider operation UNKNOWN/replay safety | IMPLEMENTED foundation | reconcile/fence before external resubmission |
| Non-monetary provider usage telemetry | IMPLEMENTED foundation | diagnostic usage where providers expose it; not a pricing/accounting contract |
| Adaptive VisualScenePlanner | TARGET | narration-driven adaptive scene/beat planning |
| Rich reuse/reframe/edit lineage | DEFERRED fast-follow | richer asset reuse after core reliability |
| Provider-side/local I2V runtime | NOT CURRENT RUNTIME | VIDEO/web generation remains separate |
| Full abrupt-process render recovery | PARTIAL | journals exist; richer resume UX remains |
| Packaging/signing/auto-update | TARGET | release hardening |

## Storage contract

```text
Generated project images        -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
PROJECT voice reference         -> Desktop ProjectStorage / manifest
GLOBAL_LOCAL voice reference    -> local application voice library
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Business/job/artifact metadata  -> PostgreSQL
```

Project media stays local. The backend does not serve media bytes.

## Rendering contract

```text
backend-authorized project snapshot
  -> paired Desktop assignment
  -> claim + lease
  -> local asset integrity/preflight
  -> FFmpeg/ffprobe
  -> local final MP4
  -> backend artifact metadata only
```

Do not claim a cloud/server fallback or remote final-video store.

## Provider and quota contract

Provider usage telemetry is operational diagnostics only. The current runtime does not expose monetary cost calculation, user credit balances, provider-pricing catalogs, pricing snapshots or reservation/refund accounting in currency.

Resource limit enforcement is non-monetary: system capacity reservations limit concurrent expensive work. Terminal job transitions consume/release those reservations and settle export units exactly once.

## VIDEO contract

`VIDEO` remains a supported analysis/editor intent. Keep web/browser video-generation behavior and mixed-media timeline support. It must not be implemented by reviving the removed Wan/Python provider path unless a future explicit architecture decision authorizes a new runtime.

See [PRODUCT_SPEC.md](PRODUCT_SPEC.md) and [ROADMAP.md](ROADMAP.md).
