# Image Generation Workflow — V1.11

Image generation produces immutable image MediaAssets for VisualBeats. NarrativeX is image-first, but image generation is separate from final FFmpeg motion/rendering and from optional I2V.

## Admission and editor flow

Desktop generation is an account/provider-consuming action. Guests may prepare project/chapter state, but the backend requires an authenticated user before AI analysis/generation admission.

Current Desktop foundation:

```text
select Chapter(s)
  -> ensure required analysis/storyboard state
  -> estimate authorized generation work
  -> enqueue
  -> observe job progress (SSE/poll fallback where applicable)
  -> review generated results
  -> materialize accepted/required result locally
  -> use/select result in production timeline
```

The renderer consumes typed backend contracts; it does not call Vertex or receive provider credentials.

## Desktop Gemini Web path

`GEMINI_WEB` is a separate Desktop-local provider path. It is selected during Chapter setup, but it does not create the backend API media-generation job or an API cost estimate. The Images screen directs this provider to Storyboard, where generation is performed per Visual Beat.

```text
Storyboard Visual Beat
  -> compile locked Gemini Web prompt in Electron main
  -> trusted preload call
  -> Electron main starts/reuses a visible Chrome profile with CDP
  -> user completes Gemini sign-in in that Chrome window when needed
  -> open fresh conversation + Images mode
  -> submit one prompt and wait for one generated image
  -> download full-size image
  -> validate extension/non-empty file + calculate SHA-256
  -> sender-bound, single-use selection token
  -> backend registers LOCAL_ONLY MediaAsset metadata
  -> Electron main commits bytes into ProjectStorage
  -> persist the asset as the Visual Beat media selection
```

The Storyboard supports single-beat Generate and a renderer-persisted `Gemini All` queue. The queue processes beats serially and supports resume, skip and stop; stopping the queue does not claim that an already-running Chrome generation was canceled. Gemini Web always uses `GENERATE_NEW`; reuse and reframe strategies are not supported on this path.

This path requires Google Chrome. `NARRATIVEX_CHROME_PATH` may point to `chrome.exe` when automatic discovery cannot find it. NarrativeX never fills Gemini credentials. The Chrome profile, downloaded staging files and CDP session metadata are owned by Electron main, and provider web-page changes can make the automation unavailable. Errors such as missing Chrome, required sign-in, a busy generation, changed Gemini UI, timeout or failed download are surfaced to the Desktop UI.

Copy Prompt uses the typed `system.copyText` preload capability and Electron main clipboard API. The renderer does not call `navigator.clipboard` or receive unrestricted system APIs.

## Durable provider execution

```text
pinned authorized image work
  -> StageAttempt claim/lease
  -> ProviderOperation persisted before external submission
  -> provider submit/status/reconcile
  -> validate/correlate result
  -> stable MediaAsset identity + checksum + lineage
  -> terminal provider/item/stage state
```

Rules:

- persist request identity/ProviderOperation before external paid submission;
- use allowed-state/CAS fences where mutable execution state requires them;
- ambiguous outcomes become `UNKNOWN` and reconcile before resubmission;
- deterministic provider/schema/correlation failures become terminal failures rather than endless UNKNOWN retry;
- completed results are immutable except idempotent same-fingerprint replay;
- provider URLs/local paths are never authoritative media identity;
- worker lease loss must stop new provider submissions and stale-owner mutation;
- one completed provider batch does not complete a parent job while other items remain pending;
- output correlation fails closed when provider rows cannot be deterministically matched.

The worker owns provider mechanics; backend policy/admission remains authoritative.

## Validation and lineage

Before an image is accepted as a durable result, validate at least:

- media decode/type;
- positive dimensions;
- expected provider response/correlation;
- aspect/crop policy metadata;
- checksum/content hash;
- stable MediaAsset metadata and insert-only lineage.

Review/rejection/regeneration must not overwrite historical generated assets. Regeneration is a new explicit attempt.

## Visual style and continuity

Image style, source identity, storyboard/beat context, Character/Location continuity and relevant reference assets belong to the immutable generation snapshot/prompt context. Clients select allow-listed product options; they must not become the authority for server-owned policy/prompt suffixes.

Gemini Web generation applies a Desktop-main-owned series style lock before the Visual Beat scene prompt is submitted. The current lock targets a premium Chinese romantic-fantasy manhua/webtoon rendering language: semi-realistic anime faces, detailed eyes/hair, polished digital painting, cinematic rim lighting, deep blue/crimson grading, and consistent serialized illustration quality. The style lock is intentionally separate from scene content so it does not force a specific character design, hair color, historical era, costume, or location that the canonical Scene/Character context does not request.

The Gemini Web wrapper also treats the Visual Beat scene text as untrusted narrative input. Scene content may control story action, characters, environment, camera, and mood, but it may not remove the series style contract, request multiple panels, or add text/logos/watermarks. This boundary keeps Generate, Generate All, and any other Gemini Web entry point visually consistent without duplicating the style prompt in renderer UI code.

Long-term reuse preference remains:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

Richer reuse/reframe/edit review behavior remains roadmap work.

## Desktop local materialization

The current Desktop creator flow materializes generated images needed by the project into ProjectStorage rather than requiring local rendering to consume arbitrary cloud URLs.

```text
validated generated image identity
  -> Desktop obtains accepted bytes through authorized backend/provider path
  -> Electron main verifies expected size/checksum
  -> commit under project assets/images
  -> project.manifest.json records relative path + integrity
  -> production timeline/render resolves mediaAssetId locally
```

Absolute local paths never become backend domain identity.

## Beat media selection

Generated images are candidates, not automatically the only final production media. The production timeline may persist an explicit media selection for a VisualBeat. The consolidated V1 `production_beat_media_selections` table supports this durable choice.

A user may also replace a beat with imported media. Image-only camera/motion controls apply only when the selected media semantics support them.

## Retained server/cloud path

Some provider/server workflows still use remote media durability:

```text
validated cloud result
  -> Cloudflare R2
  -> server/cloud pipeline or Desktop authorized materialization
```

R2 is retained server/provider storage, not the required Desktop project-media location.

## Client upload note

Do not carry forward browser-era R2 CORS instructions as the Desktop import architecture. Desktop native project imports use Electron main + backend stable asset registration + ProjectStorage. If a future workflow intentionally performs direct remote upload, document that specific remote-sync contract separately.

## Remaining work

- richer approval/reuse/reframe/edit lineage and affected-scope regeneration;
- stronger adaptive Scene/VisualBeat planning before generation;
- production hardening for large batch/retry/provider failure cases;
- complete cost/actual-usage reconciliation.
