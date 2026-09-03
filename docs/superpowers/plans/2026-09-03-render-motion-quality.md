# Render Motion and Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NarrativeX still-image motion measurably smooth, make Editor preview consume the exact pending render decisions/FPS, and make new 1080p/1440p renders use a versioned, explicit quality/frame/color contract without destabilizing subtitle alignment.

**Architecture:** Keep narration as the master clock and FFmpeg as the final media engine, but move semantic composition decisions into shared deterministic helpers. New render jobs use immutable render-profile schema v2 and renderer `project-image-motion-v3-composition`; historical schema v1 jobs stay reproducible through legacy defaults. Preview and export sample the same frame-partition/motion policy while FFmpeg uses bounded supersampling plus Lanczos unless the measured adapter fixture proves `perspective` is superior.

**Tech Stack:** Electron 44, React 19, TypeScript 7, Node 24 test runner, FFmpeg/ffprobe, Spring Boot/Java 25, MyBatis, PostgreSQL/Flyway.

**Spec:** `docs/superpowers/specs/2026-09-03-render-motion-quality-design.md`

## Global Constraints

- Narration is the master clock; visual frame rounding must never truncate narration.
- New render snapshots use schemaVersion 2, rendererVersion `project-image-motion-v3-composition`, compositionPolicyVersion 1.
- New software quality defaults are x264 `medium` + CRF 18; new NVENC defaults are `p6` + CQ 19; output pixel format is `yuv420p`.
- Historical schemaVersion 1 jobs retain `veryfast`/CRF 20 and `p5`/CQ 21 defaults.
- IMAGE framing is `COVER`; VIDEO framing is `CONTAIN`.
- V3 moving stills use deterministic `SMOOTHSTEP`; no hard-coded subtitle offset and no narration-segmentation changes in this plan.
- Current transition contract stays `CUT | FADE_BLACK`; no true cross-dissolve.
- V3 output is SDR BT.709 limited-range only; HDR inputs are not silently retagged.
- No cache artifact may cross renderer/profile/encoder versions.
- All production edits follow TDD: tests must fail before implementation and pass afterward.

## File Structure

### Shared Desktop contracts

- Modify `app/desktop/src/shared/image-motion.ts`: keep existing preset endpoints and add versioned numeric composition sampling/CSS adapter.
- Modify `app/desktop/src/shared/render-frame-clock.ts`: add project-level contiguous frame partition and frame-at-time helpers while preserving legacy per-beat helper for schema v1.
- Create `app/desktop/src/shared/video-encoding.ts`: encoder/profile types and pure FFmpeg encoder-argument builder shared by segment and final subtitle-burn encode paths.

### Preview

- Modify `app/desktop/src/renderer/features/editor/EditorScreen.tsx`: stop recomputing hard-coded AUTO decisions; use `renderController.autoEditPlan`.
- Modify `app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx`: pass selected render FPS and use frame-aware preview sampling.
- Modify `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`: authoritative IMAGE cover / VIDEO contain; viewer zoom no longer changes export framing.
- Modify `app/desktop/src/renderer/features/editor/preview-playback.ts`: quantize still-image motion to the selected render frame and use shared numeric composition samples.

### Render profile / manifest / FFmpeg

- Modify `app/desktop/src/main/rendering/render-profile.ts`: schema-aware v1/v2 parser with version-specific reproducible defaults and unknown-version rejection.
- Modify `app/desktop/src/main/rendering/render-manifest.ts`: store renderer/profile/composition/color versions, project frame windows, normalized video profile, and resolved encoder in the fingerprint.
- Modify `app/desktop/src/main/rendering/segment-renderer.ts`: exact frame-count output, shared smoothstep semantics, bounded supersampled moving-still filter, Lanczos downscale, explicit encoder args, v3 cache key.
- Modify `app/desktop/src/main/rendering/video-encoder.ts`: full-profile NVENC probe and workload-aware concurrency.
- Modify `app/desktop/src/main/rendering/project-renderer.ts`: resolve one encoder before manifest/cache production and use it for the whole attempt.
- Modify `app/desktop/src/shared/audio-muxer-args.ts`: apply the same explicit quality profile when subtitle burn-in causes the final video re-encode.
- Modify `app/desktop/src/main/rendering/audio-muxer.ts`: accept the normalized video quality profile.
- Modify `app/desktop/src/main/rendering/ffprobe.ts`: expose avg/r frame rate, frame count when requested, and color metadata needed for verification.

### Backend immutable profile v2

- Create `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/render/ProjectRenderProfileFactory.java`: canonical schema v2 JSON factory.
- Modify `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/adapter/MyBatisProjectRenderInputSnapshotAdapter.java`: create full render profile once and insert it atomically.
- Modify `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/ProjectRenderInputSnapshotMapper.java`: pass `renderProfileJson` to `insertHeader`; remove post-insert JSON mutators.
- Modify `app/backend-service/src/main/resources/mybatis/ProjectRenderInputSnapshotMapper.xml`: insert `render_profile_json` in the header statement; remove `updateFrameRate` and `updateSubtitleMode`.
- Create `app/backend-service/src/main/resources/db/migration/V9__render_profile_v2.sql`: permit schema versions 1 and 2 without rewriting historical rows.

### Tests / CI

- Create `app/desktop/test/render-composition-v3-contract.test.mjs`: red/green contract tests for shared sampling, frame partition, preview source of truth, working-resolution filter, cache/version inputs, and encoder quality.
- Modify `app/desktop/test/render-smoothness.test.mjs`: replace shallow source-presence checks with behavioral frame/easing/working-canvas assertions.
- Modify `app/desktop/test/render-manifest-subtitles.test.mjs`: schema v1/v2 parser expectations.
- Modify `app/desktop/test/audio-muxer-subtitles.test.mjs`: explicit x264/NVENC quality args on subtitle re-encode.
- Create `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/render/ProjectRenderProfileV2ContractTest.java`: exact v2 factory contract.
- Create `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/ProjectRenderProfilePersistenceContractTest.java`: mapper/migration atomic-persistence contract.
- Create `app/desktop/test/render-motion-ffmpeg.integration.test.mjs`: execute FFmpeg fixture and inspect actual frame count/motion monotonicity when FFmpeg is available in CI.
- Modify `.github/workflows/ci.yml`: ensure FFmpeg is present before Desktop checks and print tested version.

---

### Task 1: Establish RED tests for the v3 contract

**Files:**
- Create: `app/desktop/test/render-composition-v3-contract.test.mjs`
- Modify: `app/desktop/test/render-manifest-subtitles.test.mjs`
- Modify: `app/desktop/test/audio-muxer-subtitles.test.mjs`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/render/ProjectRenderProfileV2ContractTest.java`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/ProjectRenderProfilePersistenceContractTest.java`

**Interfaces:**
- Consumes: existing `image-motion.ts`, `render-frame-clock.ts`, `parseRenderProfile()`, `buildMuxNarrationArgs()` and current repository source files.
- Produces: failing assertions that define the exact public behavior subsequent tasks must satisfy.

- [ ] **Step 1: Add Desktop RED assertions without importing nonexistent named exports**

Use namespace imports so missing v3 APIs fail as assertions rather than module-load errors:

```js
import * as motion from "../src/shared/image-motion.ts";
import * as frames from "../src/shared/render-frame-clock.ts";

assert.equal(typeof motion.sampleCompositionFrame, "function");
assert.equal(typeof motion.compositionPolicyForBeat, "function");
assert.equal(typeof frames.renderProjectFrameWindows, "function");
```

Add current-source assertions proving the Editor must stop hard-coding AUTO and the segment renderer must use exact frames/Lanczos:

```js
assert.doesNotMatch(editorSource, /createBeatDecision\(selected,\s*["']AUTO["']\)/);
assert.match(editorSource, /renderController\.autoEditPlan/);
assert.match(segmentSource, /flags=lanczos/);
assert.match(segmentSource, /-frames:v/);
```

- [ ] **Step 2: Extend profile tests to require v1/v2 reproducibility**

Expected v2 normalized values:

```js
const v2 = parseRenderProfile(JSON.stringify({
  schemaVersion: 2,
  rendererVersion: "project-image-motion-v3-composition",
  compositionPolicyVersion: 1,
  fps: 60,
  video: { x264Preset: "medium", crf: 18, nvencPreset: "p6", nvencCq: 19, pixelFormat: "yuv420p" },
  color: { mode: "SDR_BT709_LIMITED" },
  subtitles: { mode: "burn_in" },
}));
assert.equal(v2.schemaVersion, 2);
assert.equal(v2.video.crf, 18);
assert.equal(v2.video.nvencCq, 19);
assert.equal(v2.colorMode, "SDR_BT709_LIMITED");
assert.throws(() => parseRenderProfile('{"schemaVersion":3}'), /Unsupported render profile schema/);
```

Also assert `{}` remains legacy v1 with `veryfast/20` and `p5/21`.

- [ ] **Step 3: Extend subtitle-mux quality tests**

Call `buildMuxNarrationArgs` with a quality profile and require:

```text
libx264: -preset medium -crf 18 -pix_fmt yuv420p
NVENC:   -preset p6 -rc vbr -cq 19 -b:v 0 -pix_fmt yuv420p
```

The existing implementation ignores those values, so these assertions must fail.

- [ ] **Step 4: Add Backend RED contract tests**

`ProjectRenderProfileV2ContractTest` first asserts the factory source/type exists and then, after implementation, will parse its JSON through Jackson and verify:

```text
schemaVersion = 2
rendererVersion = project-image-motion-v3-composition
compositionPolicyVersion = 1
fps = requested 30/60
video = medium/18, p6/19, yuv420p
color.mode = SDR_BT709_LIMITED
subtitles.mode = burn_in|none
```

`ProjectRenderProfilePersistenceContractTest` reads the MyBatis XML and migration resources and asserts:

```text
insertHeader contains render_profile_json and CAST(#{renderProfileJson} AS jsonb)
mapper has no updateFrameRate/updateSubtitleMode statements
V9 permits schema versions 1 and 2
```

- [ ] **Step 5: Trigger RED in CI**

Create a draft PR from `fix/render-composition-parity` to `main`, fetch the workflow run for the tests-only commit, and verify Desktop and Backend fail for the new v3 expectations rather than unrelated infrastructure failures.

Expected RED examples: missing `sampleCompositionFrame`, old profile object shape, missing encoder quality args, old mapper post-insert updates.

- [ ] **Step 6: Commit the RED tests**

```bash
git add app/desktop/test app/backend-service/src/test
 git commit -m "test: define render composition v3 contract"
```

---

### Task 2: Shared composition sampling and project frame partition

**Files:**
- Modify: `app/desktop/src/shared/image-motion.ts`
- Modify: `app/desktop/src/shared/render-frame-clock.ts`
- Test: `app/desktop/test/render-composition-v3-contract.test.mjs`
- Modify: `app/desktop/test/render-smoothness.test.mjs`

**Interfaces:**
- Produces: `compositionPolicyForBeat(mediaType, cameraMovement, transition)`; `sampleCompositionFrame(policy, localFrame, frameCount, fps)`; `cssTransformFromCompositionSample(sample)`; `renderProjectFrameWindows(beats,totalDurationMs,fps)`; `projectFrameAtTime(ms,fps,projectEndFrame)`.
- Consumes: existing `imageMotionPreset()` endpoints and beat millisecond boundaries.

- [ ] **Step 1: Implement deterministic easing and normalized geometry**

Use the existing movement presets as endpoints. Convert current `panX/panY` semantics to normalized source centers:

```ts
const centerX = 0.5 + 0.5 * panX * (zoom - 1) / Math.max(zoom - 1, Number.EPSILON);
```

For the zero-zoom-delta case use center `0.5`. More directly, preserve current direction with a versioned helper mapping preset pan `[-1,1]` to normalized crop center using the same crop-extent formula used by FFmpeg/CSS adapters.

Smoothstep implementation is exactly:

```ts
function smoothstep(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}
```

- [ ] **Step 2: Implement one project-level frame partition**

```ts
export function renderProjectFrameWindows(
  beats: readonly { globalStartMs:number; globalEndMs:number }[],
  totalDurationMs: number,
  fps: number,
): RenderFrameWindow[]
```

Rules: interior boundary = `Math.round(ms*fps/1000)`, final end = `Math.ceil(totalDurationMs*fps/1000)`, half-open contiguous windows, >=1 frame each, throw `Invalid render frame partition.` when impossible.

- [ ] **Step 3: Add behavioral assertions**

For 4210ms + 4165ms at 30/60 fps assert contiguous windows and final end equals `ceil(8375*fps/1000)`. For moving samples assert endpoints exact, midpoint smoothstep, monotonic zoom/pan, and `NONE` remains centered/static.

- [ ] **Step 4: Run Desktop targeted tests**

Run:

```bash
cd app/desktop && node --experimental-strip-types --experimental-transform-types --test test/render-composition-v3-contract.test.mjs test/render-smoothness.test.mjs
```

Expected: shared-contract tests PASS while preview/profile/render RED assertions remain failing until their tasks.

- [ ] **Step 5: Commit**

```bash
git add app/desktop/src/shared app/desktop/test/render-smoothness.test.mjs
 git commit -m "feat: add deterministic composition frame sampling"
```

---

### Task 3: Make Editor preview consume the pending render plan and FPS

**Files:**
- Modify: `app/desktop/src/renderer/features/editor/EditorScreen.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`
- Modify: `app/desktop/src/renderer/features/editor/preview-playback.ts`
- Test: `app/desktop/test/render-composition-v3-contract.test.mjs`

**Interfaces:**
- Consumes: `renderController.autoEditPlan`, `renderController.frameRate`, shared composition/frame helpers.
- Produces: preview state sampled from the exact render decision and selected frame rate.

- [ ] **Step 1: Remove hard-coded AUTO recomputation**

Replace:

```ts
createBeatDecision(selected, "AUTO")
```

with lookup from:

```ts
renderController.autoEditPlan?.decisions.find(
  decision => decision.visualBeatId === selected?.visualBeatId,
)
```

`previewBeat` applies that exact camera/fit/trim decision.

- [ ] **Step 2: Thread `frameRate` through PlaybackSurface and PreviewViewport**

Add typed prop `frameRate: RenderFrameRate` and call:

```ts
previewPlaybackState(selectedBeat, playheadMs, frameRate)
```

- [ ] **Step 3: Quantize image motion to an exportable frame**

Keep narration milliseconds authoritative for audio/video mediaTime. For still-image motion only, compute project frame with `floor(playheadMs*fps/1000)`, derive local frame from the beat frame window, and sample `sampleCompositionFrame`.

- [ ] **Step 4: Make framing authoritative**

In PreviewViewport:

```ts
const objectFit = selectedBeat?.mediaType === "IMAGE" ? "cover" : "contain";
```

The Fit/100%/Fill viewer control must no longer alter `objectFit`. Rename it to an inspection zoom if retained; otherwise remove it in this change.

- [ ] **Step 5: Run targeted Desktop tests**

Expected: preview-source RED assertions become GREEN; no regression in editor playback tests.

- [ ] **Step 6: Commit**

```bash
git add app/desktop/src/renderer/features/editor app/desktop/test/render-composition-v3-contract.test.mjs
 git commit -m "feat: align editor preview with render decisions"
```

---

### Task 4: Persist immutable render-profile schema v2 atomically

**Files:**
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/render/ProjectRenderProfileFactory.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/adapter/MyBatisProjectRenderInputSnapshotAdapter.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/ProjectRenderInputSnapshotMapper.java`
- Modify: `app/backend-service/src/main/resources/mybatis/ProjectRenderInputSnapshotMapper.xml`
- Create: `app/backend-service/src/main/resources/db/migration/V9__render_profile_v2.sql`
- Test: backend contract tests from Task 1.

**Interfaces:**
- Produces: `ProjectRenderProfileFactory.create(int fps, boolean subtitlesEnabled): String`.
- Consumes: validated 30/60 fps and subtitle flag already checked by the adapter/use case.

- [ ] **Step 1: Implement canonical factory**

Generate valid JSON with only validated scalar substitutions:

```json
{"schemaVersion":2,"rendererVersion":"project-image-motion-v3-composition","compositionPolicyVersion":1,"fps":60,"video":{"x264Preset":"medium","crf":18,"nvencPreset":"p6","nvencCq":19,"pixelFormat":"yuv420p"},"color":{"mode":"SDR_BT709_LIMITED"},"subtitles":{"mode":"burn_in"}}
```

Reject fps other than 30/60.

- [ ] **Step 2: Make header insert atomic**

Add `@Param("renderProfileJson") String renderProfileJson` to `insertHeader` and SQL column/value:

```sql
render_profile_json
CAST(#{renderProfileJson} AS jsonb)
```

Delete mapper methods and XML statements `updateFrameRate` and `updateSubtitleMode`.

- [ ] **Step 3: Add V9 compatibility migration**

Drop/recreate only `ck_project_render_profile_version` so schemaVersion IN (1,2). Do not rewrite existing row JSON and do not change historical data.

- [ ] **Step 4: Run Backend targeted/full verify**

```bash
cd app/backend-service && ./mvnw --batch-mode --no-transfer-progress -Dtest=ProjectRenderProfileV2ContractTest,ProjectRenderProfilePersistenceContractTest test
./mvnw --batch-mode --no-transfer-progress verify
```

Expected: both new tests and full Backend verify PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend-service
 git commit -m "feat: persist immutable render profile v2"
```

---

### Task 5: Normalize quality profile and choose one encoder per render attempt

**Files:**
- Create: `app/desktop/src/shared/video-encoding.ts`
- Modify: `app/desktop/src/main/rendering/render-profile.ts`
- Modify: `app/desktop/src/main/rendering/video-encoder.ts`
- Modify: `app/desktop/src/main/rendering/render-manifest.ts`
- Modify: `app/desktop/src/main/rendering/project-renderer.ts`
- Modify: `app/desktop/src/shared/audio-muxer-args.ts`
- Modify: `app/desktop/src/main/rendering/audio-muxer.ts`
- Tests: profile/mux/v3 contract tests.

**Interfaces:**
- Produces `VideoEncoder`, `VideoQualityProfile`, `buildVideoEncodeArgs(encoder,profile)`.
- `parseRenderProfile()` returns schema/version/fps/subtitle/video/color values.
- `resolveVideoEncoderForProfile(ffmpegPath, hardwareCandidate, profile,width,height)` selects final encoder before manifest/cache.
- `buildLocalRenderManifest(render, videoEncoder)` fingerprints the final encoder and profile.

- [ ] **Step 1: Implement schema-aware parsing**

Explicit schemaVersion 1 => legacy defaults; schemaVersion 2 => v3 defaults/validated allow-lists; explicit unknown schema => throw. Invalid/missing individual v2 video values fall back to v2 defaults, not v1 defaults.

- [ ] **Step 2: Add shared encoder arg builder**

```ts
libx264 => ["-c:v","libx264","-preset",profile.x264Preset,"-crf",String(profile.crf),"-pix_fmt",profile.pixelFormat]
h264_nvenc => ["-c:v","h264_nvenc","-preset",profile.nvencPreset,"-rc","vbr","-cq",String(profile.nvencCq),"-b:v","0","-pix_fmt",profile.pixelFormat]
```

- [ ] **Step 3: Probe full NVENC profile before segment work**

Probe one frame at the actual target width/height with selected preset/rate-control/pixel format. If it fails, select libx264 before cache keys or manifest fingerprint are finalized.

- [ ] **Step 4: Make manifest immutable/fingerprint-aware**

Add rendererVersion/compositionPolicyVersion/schemaVersion/video/color/videoEncoder fields and include them in canonical fingerprint.

- [ ] **Step 5: Apply profile to final subtitle burn-in encode**

`buildMuxNarrationArgs` uses `buildVideoEncodeArgs` when subtitlePath is non-null; subtitle-free final mux remains `-c:v copy`.

- [ ] **Step 6: Run targeted Desktop tests**

Expected: profile and mux RED tests become GREEN.

- [ ] **Step 7: Commit**

```bash
git add app/desktop/src app/desktop/test
 git commit -m "feat: apply versioned render encoding profiles"
```

---

### Task 6: Render exact frame windows with smooth bounded still-image motion

**Files:**
- Modify: `app/desktop/src/main/rendering/segment-renderer.ts`
- Modify: `app/desktop/src/main/rendering/render-manifest.ts`
- Modify: `app/desktop/src/main/rendering/video-encoder.ts`
- Modify: `app/desktop/test/render-smoothness.test.mjs`
- Test: `app/desktop/test/render-composition-v3-contract.test.mjs`

**Interfaces:**
- Consumes: manifest beat `startFrame/endFrame/frameCount`, shared composition preset semantics, normalized video profile.
- Produces exact `frameCount` encoded frames and v3 cache artifacts.

- [ ] **Step 1: Store frame windows on manifest beats**

Use one `renderProjectFrameWindows` call over globally ordered beats and attach `startFrame`, `endFrame`, `frameCount` to each manifest beat. The final project end frame must be ceil(totalDuration*fps/1000).

- [ ] **Step 2: Implement bounded working dimensions**

```ts
workingScale = movement === "NONE" ? 1 : 2
candidate = target * workingScale
if longEdge > 5120: scale both dimensions down proportionally
force even dimensions
never below target
```

- [ ] **Step 3: Generate moving-still filter**

For v3 moving images:

```text
format=gbrp
scale=<workingW>:<workingH>:force_original_aspect_ratio=increase:flags=lanczos
crop=<workingW>:<workingH>
zoompan=<shared endpoint + smoothstep expression>:d=<frameCount>:s=<workingW>x<workingH>:fps=<fps>
scale=<targetW>:<targetH>:flags=lanczos
setsar=1
format=yuv420p
```

Static images skip the oversized working canvas. Keep target frame count authoritative.

- [ ] **Step 4: Encode exact frames**

Use `-frames:v <frameCount>` and CFR timestamps/selected fps; do not depend on `-t` alone. Video fit modes may still use input duration for source selection but encoded output terminates by assigned frame count.

- [ ] **Step 5: Version cache keys**

Use `project-image-motion-v3-composition` plus schema/composition/adapter/working dimensions/frame window/framing/motion/easing/transitions/encoder/video-profile/color fields.

- [ ] **Step 6: Apply performance concurrency**

For moving-still working canvas >=3840x2160: 60fps => max1, 30fps => max2; lower sizes retain encoder cap <=4. Respect a lower explicit user env concurrency setting.

- [ ] **Step 7: Run targeted tests and commit**

```bash
cd app/desktop && npm test -- --test-name-pattern="render|motion|mux"
```

If the package script does not forward Node options correctly, run `npm test` in full.

Commit:

```bash
git add app/desktop/src/main/rendering app/desktop/test
 git commit -m "feat: render smooth frame-quantized image motion"
```

---

### Task 7: Add real FFmpeg motion/cadence integration coverage

**Files:**
- Create: `app/desktop/test/render-motion-ffmpeg.integration.test.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify if required: `app/desktop/src/main/rendering/ffprobe.ts`

**Interfaces:**
- Consumes: actual `ffmpeg`/`ffprobe` executable and generated filters.
- Produces measurable evidence for real decoded frame behavior.

- [ ] **Step 1: Ensure CI exposes FFmpeg**

Add a Desktop-job step before tests:

```yaml
- name: Verify FFmpeg test runtime
  run: ffmpeg -version && ffprobe -version
```

GitHub Ubuntu runner FFmpeg is the tested CI runtime; packaged Windows smoke remains a release verification item.

- [ ] **Step 2: Build deterministic fixture in the test**

Generate a high-contrast PNG using FFmpeg `color`/`drawbox`, then render a one-second 60fps pan using the same production filter builder. Decode frames to a simple lossless/gray representation and calculate the moving edge centroid.

- [ ] **Step 3: Assert measured motion**

Require exactly 60 frames, monotonic centroid, no backward jump, and max target-space positional error <=0.5 px against the expected sample sequence. Render the old target-resolution zoompan baseline in the same test and assert v3 has lower maximum quantization error.

- [ ] **Step 4: Add cadence/color verification**

Use ffprobe to assert width/height, `r_frame_rate`, `avg_frame_rate`, decoded frame count, and BT.709 tags for the v3 fixture.

- [ ] **Step 5: Run Desktop full check and commit**

```bash
cd app/desktop && npm run check
```

Commit:

```bash
git add .github/workflows/ci.yml app/desktop/test app/desktop/src/main/rendering/ffprobe.ts
 git commit -m "test: verify render motion with ffmpeg frames"
```

---

### Task 8: Source-resolution preflight and final narration-tail verification

**Files:**
- Inspect/Modify: `app/desktop/src/renderer/features/production/render-preflight.ts`
- Inspect/Modify corresponding main/preload preflight implementation that resolves local asset paths.
- Modify: `app/desktop/src/main/rendering/project-renderer.ts`
- Modify: `app/desktop/src/main/rendering/ffprobe.ts`
- Test: create focused preflight/verification tests under `app/desktop/test/` following existing preflight test location.

**Interfaces:**
- Produces effective source-resolution warnings and final audio/video duration verification.

- [ ] **Step 1: Add RED preflight tests against existing public preflight helper**

Use synthetic source/target dimensions and maximum planned zoom. Require no warning when effective crop >= target, quality warning below target, and strong warning below 75% on either dimension.

- [ ] **Step 2: Implement effective source-detail calculation**

Calculate cover crop against target aspect ratio, divide effective crop by maximum zoom, compare both dimensions with target. Warning text includes beat ID and effective/target dimensions; warnings never block an otherwise readable SDR image.

- [ ] **Step 3: Verify final narration coverage**

After mux, probe video and audio durations. Fail verification if audio is shorter than the materialized narration source or if video is shorter than narration. Accept video tail `< 1000/fps` ms. If pre-mux concatenated video is shorter because of container timestamp edge, pad/clone the final frame before final mux.

- [ ] **Step 4: Run Desktop full check and commit**

```bash
cd app/desktop && npm run check
```

Commit:

```bash
git add app/desktop/src app/desktop/test
 git commit -m "feat: validate source detail and narration render coverage"
```

---

### Task 9: Full verification, review, and PR readiness

**Files:** no planned production edits unless verification finds a defect.

- [ ] **Step 1: Run complete repository-equivalent checks**

Required evidence:

```text
Repository gates: secret scan, docs drift, compose config
Backend: ./mvnw --batch-mode --no-transfer-progress verify
Desktop: npm ci && npm run check
AI worker: should remain unchanged; CI must still pass its baseline pytest/Ruff/mypy gates
```

- [ ] **Step 2: Verify the original symptoms with explicit evidence**

Check:

```text
Preview no longer hard-codes AUTO.
IMAGE preview is cover; VIDEO preview is contain.
Project final frame count uses ceil and video is not shorter than narration.
60fps FFmpeg fixture contains 60 decoded frames and passes monotonic/error metric.
1440p job uses explicit v2 quality profile.
Subtitle burn-in uses same explicit video quality args.
Cache fingerprint changes across renderer/profile/encoder variants.
```

- [ ] **Step 3: Inspect PR diff for scope creep**

Confirm no AI-worker narration segmentation/alignment or subtitle cue-generation changes entered this workstream.

- [ ] **Step 4: Fetch GitHub Actions results**

All four jobs must be green: Repository gates, Backend verify, AI worker checks, Desktop check. If a job fails, inspect its logs and fix only the demonstrated cause before making any completion claim.

- [ ] **Step 5: Mark PR ready only after verification**

Update the draft PR description with test evidence and make it ready for review only after the verification-before-completion checklist is satisfied.
