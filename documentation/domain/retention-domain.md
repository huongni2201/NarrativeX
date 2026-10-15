# Retention Domain Model & Engine

**Status:** PARTIAL domain model; autonomous retention planning and feedback are not implemented
**Authority:** ADR-0031  
**Current implementation:** `HookPlan`, `RetentionMap`, and `AttentionEvent` records exist and are materialized by Chapter Analysis. This document describes their intended meaning, not a shipped retention engine.

---

## 1. Principles

Retention data can describe narrative hooks, tension, questions, and attention events for creator review. The current system does not automatically enforce pacing rules, optimize hooks, or retune production from post-publish analytics. Those behaviors remain TARGET or DEFERRED under [ADR-0031](../decisions/ADR-0031-retention-driven-narrative-planning.md).

---

## 2. HookPlan

Formulated per Chapter / Episode to maximize 30-second retention:

```typescript
interface HookPlan {
  id: string;
  chapterId: string;
  promise: string;              // What transformation or discovery is promised
  conflict: string;             // Core antagonistic force introduced immediately
  curiosityQuestion: string;    // Central question compelling the viewer to stay
  visualHook: string;           // Striking opening shot or unexpected visual contrast
  dialogueHook: string;         // Provocative line or opening narration statement
  withheldInformation: string;  // Crucial context intentionally obscured until payoff
  payoffBeatId: string;         // Target beat where the curiosity question is answered
}
```

---

## 3. RetentionMap & Tension Curve

Maintains structural narrative pacing across the Chapter:

```typescript
interface RetentionMap {
  id: string;
  chapterId: string;
  segments: RetentionSegment[];
  openQuestions: string[];
  resolvedQuestions: string[];
  attentionEvents: AttentionEvent[];
  pacingWarnings: PacingWarning[];
}

interface RetentionSegment {
  orderIndex: number;
  timeStartMs: number;
  timeEndMs: number;
  tensionLevel: number; // Normalized 0.0 (calm) to 1.0 (peak intensity)
  dominantEmotion: string;
  retentionRole: RetentionRole;
}

type RetentionRole =
  | "HOOK"
  | "INCITING"
  | "ESCALATION"
  | "MIDPOINT_SHIFT"
  | "CLIMAX"
  | "TWIST"
  | "RESOLUTION"
  | "COOLDOWN";
```

---

## 4. Attention Event Detector

An `AttentionEvent` represents a perceptible shift that resets audience attention.

### Event Taxonomy
- `NEW_INFORMATION`: Key plot discovery.
- `QUESTION`: Explicit spoken or visual question posed.
- `REVEAL`: Withheld secret or character true nature unveiled.
- `CONFLICT`: Direct confrontation or physical obstacle.
- `CHARACTER_ENTRANCE`: New actor or significant character appears.
- `LOCATION_CHANGE`: Cut or transition to distinct environment.
- `VISUAL_CHANGE`: Radical change in lighting, shot scale, or composition.
- `SOUND_CHANGE`: Sudden sound effect, silence, or score shift.
- `REACTION`: Extreme emotional response on character face.
- `PAYOFF`: Climax of an earlier setup.

### Pacing Risk Guardrail
The stored model can carry pacing warnings, but there is no enforced 12–15 second runtime threshold. Automatic warning generation and production changes based on those warnings remain TARGET; post-publish automated retuning is DEFERRED.
