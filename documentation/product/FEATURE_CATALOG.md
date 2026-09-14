# NarrativeX — Current Feature Catalog (V1.11)

Current code, Flyway migrations and automated tests decide factual AS-IS claims. Accepted ADRs refine cross-cutting architecture. Roadmap intent must not be presented as implemented runtime.

| Feature | Status | Current direction |
|---|---|---|
| Stable installation guest identity | IMPLEMENTED | guest ownership/session continuity |
| Google-only account sign-in | IMPLEMENTED | system browser + one-time Desktop handoff |
| Project/Chapter authoring | IMPLEMENTED foundation | backend-authoritative persistence + Desktop UI |
| Chapter Analyze | IMPLEMENTED | durable job/provider lifecycle |
| Character/Location continuity | IMPLEMENTED foundation | richer review/reference locking remains partial |
| Scene / VisualBeat storyboard | IMPLEMENTED foundation | review + generation preparation |
| `IMAGE` visual intent | IMPLEMENTED | API/worker and Gemini Web image workflows |
| `VIDEO` visual intent | IMPLEMENTED foundation | retained in Analyze Chapter for web/browser video-generation workflows |
| Python/Wan video provider | REMOVED | do not restore as implicit VIDEO/final-render fallback |
| VoiceStudio narration | IMPLEMENTED foundation | segmented headless TTS persists a project-local WAV master |
| User-provided narration | IMPLEMENTED foundation | native import + logical audio clock |
| Vertex image generation | IMPLEMENTED foundation | durable provider operation + local media result |
| Gemini Web image generation | IMPLEMENTED foundation | Electron Chrome/CDP + local commit |
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
| R2 voice-reference/custom-voice storage | IMPLEMENTED foundation | only current R2 responsibility |
| MyBatis production persistence | IMPLEMENTED | explicit PostgreSQL SQL |
| Flyway clean pre-production baseline | IMPLEMENTED | clean DB applies squashed V1–V8 final schema directly; former V9–V18 patch history is folded away |
| Monetary billing / credit runtime | REMOVED | no monetary estimates, pricing snapshots, credit balances, billing owner or cost-limit status |
| Non-monetary capacity/export quota | IMPLEMENTED foundation | `CAPACITY` and `LONGFORM_EXPORT` reservations with exactly-once terminal settlement |
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
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
ACCOUNT voice reference/custom voice -> Cloudflare R2
Business/job/artifact metadata  -> PostgreSQL
```

R2 is not generated-project-media transport, fallback storage or final-video storage.

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

Quota enforcement remains non-monetary: capacity reservations limit concurrent expensive work and long-form export reservations enforce period export limits. Terminal job transitions consume/release those reservations and settle export units exactly once.

## VIDEO contract

`VIDEO` remains a supported analysis/editor intent. Keep web/browser video-generation behavior and mixed-media timeline support. It must not be implemented by reviving the removed Wan/Python provider path unless a future explicit architecture decision authorizes a new runtime.

See [PRODUCT_SPEC.md](PRODUCT_SPEC.md) and [ROADMAP.md](ROADMAP.md).
