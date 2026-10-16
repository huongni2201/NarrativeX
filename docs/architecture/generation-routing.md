# Generation Routing Architecture

**Status:** active runtime admits T2V only; extended strategies remain TARGET
**Authority:** ADR-0008
**Date:** 2026-09-20  

---

## 1. Responsibilities

The `GenerationRouter` sits in the backend application layer between `Shot` planning and GPU execution. It is model- and provider-agnostic. It analyzes a `Shot` aggregate, its dramatic context, character requirements, and reference assets to synthesize a `GenerationPlan`.

```text
Shot Aggregate + Continuity Context
      ↓
GenerationRouter.route(shot, context)
      ↓
GenerationPlan:
  - Strategy: T2V | I2V | FIRST_LAST_FRAME | MULTI_KEYFRAME | VIDEO_EXTEND | VIDEO_RETAKE
  - Conditioned References: Character, Location, Keyframes
  - Compiled Video Prompt: Subject, Action, Camera, Motions, Temporal Progression
  - Quality Profile: Resolution, FPS, Motion Intensity, Denoise / Steps
  - Continuity Input: Tail-frame or Clip from preceding shot (if continuous)
```

---

## 2. Routing Decision Matrix

The matrix describes target strategy selection. The current pinned `video.generate:1.1` profile only admits T2V at 1280×720/24 FPS/16:9. I2V, First/Last Frame, reference artifacts and AUDIO_FIRST fail preflight before a Take or job is created. Extended strategies remain TARGET. See [current status](../current-status.md); enum/route availability is not executor readiness.

| Strategy | When Selected | Required Inputs | Invariants & Fallbacks |
|---|---|---|---|
| **TEXT_TO_VIDEO (T2V)** | Environment establishing, atmospheric b-roll, generic crowd scenes, shots without recurring characters. | Text prompt with scene lighting, camera movement, and world physics. | No character face conditioning. Fallback if I2V reference generation fails for non-critical subjects. |
| **IMAGE_TO_VIDEO (I2V)** | Dialogue, character close-ups, emotional reactions, recurring characters. | Approved `CHARACTER_REFERENCE` image(s) and/or `LOCATION_REFERENCE`. | Fails preflight if a required character has no approved visual reference. |
| **FIRST_LAST_FRAME** | Critical camera or actor moves starting and landing on exact compositions; spatial reveals. | `START_FRAME` and `END_FRAME` image references. | Both frames must match aspect ratio and camera lens geometry. |
| **MULTI_KEYFRAME** | Complex multi-stage actions (e.g., character stands up, walks to window, looks back). | Ordered array of `KEYFRAME` references (2–4 frames). | Model must support temporal interpolation between key milestones. |
| **VIDEO_EXTEND** | Sustained continuous camera tracking, slow pan, or action spilling over from previous shot. | Tail frames / source video asset of the immediately preceding shot. | Requires `continuityFromShotId` to be valid, passed, and rendered. |
| **VIDEO_RETAKE** | Refining facial expression, background motion, or minor defects in an existing take without full regeneration. | Existing take video asset + mask or delta prompt. | Fallback to I2V with modified seed/prompt if retake capabilities are unavailable. |

---

## 2a. Location and continuity in the video prompt (IMPLEMENTED, text only)

Take admission (`GenerateShotTakeUseCase`) and the "Compiled Video Prompt" preview (`BackendPromptPreviewSource`) resolve the Shot's Location through the same path, `ShotLocationContextRepository`: Shot → ShotSequence → VisualBeat → Scene → `scenes.project_location_id`. `shots.location_ref` is a free-text fallback used only when the Scene has no Location.

- A resolved Location adds `Setting: <name>: <visual_prompt>` (falling back to `description`, capped at 600 characters on a sentence boundary). The text is identical for every Shot of the Scene, so the Beat does not re-describe the place.
- A Shot with a preceding Shot in the same Scene (ordered Beat → Sequence → Shot) also gets `Continuity: same location (<name>) as the previous shot, keep architecture, prop layout, lighting and time of day unchanged; previous shot ended with <end_state>`. The first Shot of a Scene has none.
- The Take snapshot records `context.locationContext` (`locationId`, `specHash`, `previousShotId`, `continuityHash`). It is part of the request fingerprint, so editing a Location changes the identity of new operations while admitted Takes and frozen batch prompts keep what they were admitted with. A replay of a Take admitted before this field existed still matches.
- Batch freeze loads the Location context of all Shots with one query.

This only reduces drift. Text-to-video does not guarantee identical architecture; visual anchoring needs the reference-conditioning capability that `video.generate:1.1` and `image.generate` do not have yet (see [location-continuity plan](../plans/location-continuity.md), phases 3–5).

---

## 3. LTX-2.5 Infrastructure Adapter Isolation

Logic specific to LTX-2.5 (e.g. DiT scheduling, NVFP4 quantization, attention heads, latent dimension conventions) resides strictly inside the GPU worker adapter (`app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/`). The backend domain never couples to LTX-specific tensor formats or command-line parameters.
