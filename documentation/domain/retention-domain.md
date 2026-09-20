# Retention Domain Model & Engine

**Status:** Authoritative Domain Specification  
**Authority:** ADR-0031  
**Date:** 2026-09-20  

---

## 1. Principles

Viewer retention is not merely a post-publish analytics readout; it is an active constraint during story and shot planning. The Retention Engine ensures narrative velocity, timely hook deployment, balanced tension curves, and continuous sensory engagement.

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
If elapsed narration exceeds 12–15 seconds without at least one detected Attention Event or state change, the Retention Engine issues a `PACING_RISK` warning. This alerts the director to introduce a reaction shot, angle shift, or sound cue before committing expensive GPU generation.
