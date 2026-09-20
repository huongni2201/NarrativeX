# Generation Routing Architecture

**Status:** Authoritative Routing Specification  
**Authority:** ADR-0028, ADR-0029  
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

| Strategy | When Selected | Required Inputs | Invariants & Fallbacks |
|---|---|---|---|
| **TEXT_TO_VIDEO (T2V)** | Environment establishing, atmospheric b-roll, generic crowd scenes, shots without recurring characters. | Text prompt with scene lighting, camera movement, and world physics. | No character face conditioning. Fallback if I2V reference generation fails for non-critical subjects. |
| **IMAGE_TO_VIDEO (I2V)** | Dialogue, character close-ups, emotional reactions, recurring characters. | Approved `CHARACTER_REFERENCE` image(s) and/or `LOCATION_REFERENCE`. | Fails preflight if a required character has no approved visual reference. |
| **FIRST_LAST_FRAME** | Critical camera or actor moves starting and landing on exact compositions; spatial reveals. | `START_FRAME` and `END_FRAME` image references. | Both frames must match aspect ratio and camera lens geometry. |
| **MULTI_KEYFRAME** | Complex multi-stage actions (e.g., character stands up, walks to window, looks back). | Ordered array of `KEYFRAME` references (2–4 frames). | Model must support temporal interpolation between key milestones. |
| **VIDEO_EXTEND** | Sustained continuous camera tracking, slow pan, or action spilling over from previous shot. | Tail frames / source video asset of the immediately preceding shot. | Requires `continuityFromShotId` to be valid, passed, and rendered. |
| **VIDEO_RETAKE** | Refining facial expression, background motion, or minor defects in an existing take without full regeneration. | Existing take video asset + mask or delta prompt. | Fallback to I2V with modified seed/prompt if retake capabilities are unavailable. |

---

## 3. LTX-2.5 Infrastructure Adapter Isolation

Logic specific to LTX-2.5 (e.g. DiT scheduling, NVFP4 quantization, attention heads, latent dimension conventions) resides strictly inside the GPU worker adapter (`app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/`). The backend domain never couples to LTX-specific tensor formats or command-line parameters.
