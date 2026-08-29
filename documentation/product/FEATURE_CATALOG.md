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
| VieNeu narration | IMPLEMENTED foundation | generated narration persists project-locally |
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
| Flyway V1–V8 clean baseline | IMPLEMENTED | pre-production baseline; no patch-only V9 |
| Adaptive VisualScenePlanner | TARGET | narration-driven adaptive scene/beat planning |
| Rich reuse/reframe/edit lineage | DEFERRED fast-follow | richer asset reuse after core reliability |
| Provider-side/local I2V runtime | NOT CURRENT RUNTIME | VIDEO/web generation remains separate |
| Full abrupt-process render recovery | PARTIAL | journals exist; richer resume UX remains |
| Complete billing/actual-usage reconciliation | PARTIAL | estimate/reservation/actual usage remain distinct |
| Packaging/signing/auto-update | TARGET | release hardening |

## Storage contract

```text
Generated project images        -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Voice reference/custom voice    -> R2 when remote account storage is required
Business/job/artifact metadata  -> PostgreSQL
```

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

## VIDEO contract

`VIDEO` remains a supported analysis/editor intent. Keep web/browser video-generation behavior and mixed-media timeline support. It must not be implemented by reviving the removed Wan/Python provider path unless a future explicit architecture decision authorizes a new runtime.

See [PRODUCT_SPEC.md](PRODUCT_SPEC.md) and [ROADMAP.md](ROADMAP.md).
