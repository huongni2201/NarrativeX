# Generation Domain, Takes & Video QA

**Status:** PARTIAL domain model; take validation metadata exists, while automatic semantic QA and reason-aware retries remain TARGET
**Authority:** ADR-0028, ADR-0029, ADR-0030  
**Current runtime limit:** the pinned Native AV profile admits T2V only. Reference-conditioned strategies described here are not currently admissible.

---

## 1. Take & SelectedTake

### Take Entity
Represents an individual generation attempt for a `Shot`:

```typescript
interface Take {
  id: string;
  shotId: string;
  attemptNumber: number;
  provider: string;
  model: string;
  generationMode: GenerationStrategy;
  outputAssetId?: string;
  sourceDurationMs?: number;
  metricsJson: string;
  validationStatus: string;
  validationFailureCategory?: VideoQAFailureCategory;
  validationFailureReason?: string;
  validationRetryRecommendation?: string;
  status: string;
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

`Take` can persist one failure category, a reason, and a retry recommendation. The category vocabulary includes:

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

This metadata does not establish that an automated visual classifier evaluates every category. Current take admission and technical validation limits are tracked in [current status](../CURRENT_STATUS.md).

## 3. Retry and recovery boundary

Ambiguous provider outcomes remain `UNKNOWN` until reconciled; blind resubmission is prohibited. A stored retry recommendation is diagnostic metadata and does not by itself trigger a new attempt. Reference-dependent remedies are unavailable while the active profile only admits T2V.

- New attempts require a deliberate retry decision and a new idempotency intent.
- I2V, reference weighting, and preceding-frame conditioning remain blocked until an advertised worker profile and runtime proof support them.
