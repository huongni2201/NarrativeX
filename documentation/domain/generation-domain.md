# Generation Domain, Takes & Video QA

**Status:** Authoritative Domain Specification  
**Authority:** ADR-0028, ADR-0029, ADR-0030  
**Date:** 2026-09-20  

---

## 1. Take & SelectedTake

### Take Entity
Represents an individual generation attempt for a `Shot`:

```typescript
interface Take {
  id: string;
  shotId: string;
  attemptNumber: number;

  provider: string;              // e.g. "ltx", "remote-gpu"
  model: string;                 // e.g. "ltx-2.5-nvfp4"
  generationMode: GenerationStrategy;

  outputAssetId?: string;        // ID of generated mp4 video asset
  durationMs?: number;           // Actual duration of footage returned by model
  metrics: {
    generationTimeMs: number;
    promptTokens?: number;
    vramPeakMb?: number;
  };

  validationResult?: VideoValidationResult;
  status: "PENDING" | "RUNNING" | "GENERATED" | "VALIDATING" | "PASSED" | "FAILED";
}
```

### SelectedTake Value Object
Associates a specific `Take` with in/out editing trim points for a `Shot`:

```typescript
interface SelectedTake {
  shotId: string;
  takeId: string;
  sourceInMs: number;   // Timestamp in source clip where edit begins
  sourceOutMs: number;  // Timestamp in source clip where edit ends
}
```

---

## 2. Video QA Failure Taxonomy

`VideoQA` evaluates completed takes against 11 failure categories:

1. `FACE_IDENTITY`: Distorted facial features, incorrect eye/hair color, or drift from character reference.
2. `CHARACTER_CONSISTENCY`: Outfit, build, or age discrepancies between consecutive shots.
3. `ANATOMY`: Extra limbs, distorted hands, or impossible posture.
4. `MOTION`: Unnatural physics, rubber-banding, jitter, or chaotic movement.
5. `TEMPORAL_ARTIFACT`: Flickering, boiling noise, texture pop-in across frames.
6. `CAMERA`: Failure to follow requested camera motion (e.g. pan instead of track, shaky camera).
7. `COMPOSITION`: Key subject cut off by frame edge or poor visual balance.
8. `PROMPT_ADHERENCE`: Action or requested environment feature missing from scene.
9. `CONTINUITY`: Abrupt lighting or background shift across contiguous shots.
10. `DURATION`: Output video length under threshold.
11. `TECHNICAL_OUTPUT`: Corrupt container, dropped frames, encoding decode errors.

---

## 3. Reason-Aware Retry Policy

Blind retries with identical prompts and configurations are prohibited. When a failure occurs, the retry policy applies targeted remedies:

- `FACE_IDENTITY` → Boost reference attention weight, reduce camera motion complexity, or switch strategy from T2V to I2V.
- `MOTION` → Simplify action description, reduce motion speed keywords, clamp frame duration.
- `CAMERA` → Simplify camera instruction (e.g., switch from complex crane-track to static or slow dolly).
- `CONTINUITY` → Inject end-frame of preceding take as condition input.
- `TEMPORAL_ARTIFACT` → Adjust inference steps or switch quality profile.
