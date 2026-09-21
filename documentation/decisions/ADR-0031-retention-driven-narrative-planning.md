# ADR-0031: Retention-Driven Narrative Planning and Post-Publish Feedback Loop

## Status

Accepted

## Context

Audience drop-off in long-form digital storytelling (e.g. YouTube narrative content) occurs primarily during:
1. The first 30 seconds (failure to deliver a compelling visual/narrative hook).
2. Exposition plateaus (lengthy dialogue or world-building without dramatic conflict or sensory changes).
3. Abandoned curiosity loops (questions set up early that never receive a payoff).

Traditionally, retention analysis is performed strictly post-hoc after publishing. In NarrativeX, retention must act as a first-class planning constraint before expensive media generation begins.

## Decision

1. **Pre-Generation Retention Planning**:
   Every Chapter/Episode requires:
   - `HookPlan`: Explicitly defines the initial promise, conflict, curiosity question, visual hook, dialogue hook, withheld information, and payoff beat.
   - `RetentionMap`: Models narrative tension, emotional progression, open curiosity loops, and resolved payoffs across the timeline.
   - `AttentionEventDetector`: Inspects the narrative flow for sensory and dramatic shifts (`NEW_INFORMATION`, `CONFLICT`, `REVEAL`, `LOCATION_CHANGE`, `REACTION`, etc.). Prolonged spans without events trigger `PACING_RISK` warnings.

2. **Decoupled Prompt Contracts in Gemini Story Director**:
   Instead of a single monolithic prompt, Gemini analysis is decomposed into discrete, typed schema prompts:
   - `story-analysis`
   - `story-adaptation`
   - `character-bible` & `world-bible`
   - `hook-plan`
   - `retention-map`
   - `scene-plan` & `visual-beat-plan`
   - `shot-sequence-plan` & `shot-plan`

3. **Post-Publish Feedback Loop (Phase H)**:
   Retention analytics imported from publishing platforms (drop-offs, average view duration, peaks, dips) will be mapped back to timeline timestamps, edit decisions, shots, and beats to generate `RetentionObservation` and `ProductionInsight` suggestions for future story planning.

## Consequences

- Story Director generates actionable retention structures alongside the script.
- Pacing defects are caught in the text/beat stage before consuming GPU minutes.
- Provides the data schema foundation for ongoing algorithmic narrative improvement.
