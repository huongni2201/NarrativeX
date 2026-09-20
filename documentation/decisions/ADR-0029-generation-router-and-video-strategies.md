# ADR-0029: Generation Router and Model-Agnostic Video Strategies

## Status

Accepted

## Context

Video generation models exhibit different strengths and costs depending on input modality:
- Text-to-Video (T2V) excels at fluid natural environments and wide camera motions but struggles with character facial consistency across shots.
- Image-to-Video (I2V) excels at character fidelity and dialogue close-ups but can suffer from static backgrounds or distorted motion if pushed too far.
- First/Last Frame, Multi-Keyframe, Extend, and Retake modes offer specialized control for reveals, complex actions, and corrections.

Hard-coding all shots to a single strategy (e.g., all I2V or all T2V) produces suboptimal quality, excessive reference preparation overhead, or character drift.

## Decision

1. **Implement an Application-Layer GenerationRouter**:
   Introduce a domain-agnostic `GenerationRouter` in `app/backend-service` that dynamically assigns the optimal `GenerationStrategy` for each `Shot`:
   - `TEXT_TO_VIDEO`: Atmospheric establishing shots, b-roll, generic crowd scenes without recurring character identity constraints.
   - `IMAGE_TO_VIDEO`: Recurring characters, dialogue beats, emotional close-ups anchored by approved character references.
   - `FIRST_LAST_FRAME`: Critical camera or actor moves requiring precise starting and landing compositions.
   - `MULTI_KEYFRAME`: Complex choreographies with distinct progress milestones.
   - `VIDEO_EXTEND`: Continuous camera moves or physical actions extending from a previous take.
   - `VIDEO_RETAKE`: Iterative refinement of an existing take without full regeneration.

2. **Isolate Video Provider Logic in Infrastructure Adapters**:
   Domain and routing logic must remain free of provider-specific SDKs or parameters. LTX-2.5 specific scheduling, NVFP4 quantization parameters, and latent tensor dimensions reside strictly in `app/generation-service` adapters behind Compute Protocol v1.

3. **Capability Matrix Enforcement**:
   The GPU worker advertises supported video generation capabilities (`VideoGenerationCapabilities`) via Compute Protocol. If a worker lacks a specialized mode (e.g. multi-keyframe), the `GenerationRouter` transparently degrades to supported fallback strategies (e.g. I2V).

## Consequences

- Domain models remain completely decoupled from underlying video generation models.
- Optimizes GPU utilization and visual quality by selecting the most appropriate generation mode per shot.
