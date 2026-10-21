# Retention Domain

Persisted retention data only. There is **no retention engine**. Scope: [ADR-0008](../decisions/ADR-0008-video-first-shot-production.md), item 10.

## What exists

| Data | Where | Notes |
|---|---|---|
| `dramatic_intent` | `visual_beats` | Dramatic function of the beat, default `SETUP`. |
| `retention_role` | `visual_beats`, `shots` | `HOOK`, `INCITING`, `ESCALATION`, `MIDPOINT_SHIFT`, `CLIMAX`, `TWIST`, `RESOLUTION`, `COOLDOWN`. |
| `hook_plans` | V4 | Hook architecture for the opening of an episode: promise, conflict, curiosity question, visual and dialogue hooks, withheld information, payoff beat. |
| `retention_maps` | V4 | Tension curve, open and resolved questions, pacing warnings. |
| `attention_events` | V4 | Sensory and dramatic shifts with type, time offset, description and severity. |

Analysis may produce these and the creator may review them. Nothing consumes them to change generation, pacing or editing.

## What does not exist

Automatic pacing enforcement, a Shot Director, an Editing Director, an automatic semantic QA loop and post-publish audience feedback (`production_insights` is retired). Each needs its own ADR before implementation.

## Related

[Domain model](domain-model.md) · [Database](../architecture/database.md)
