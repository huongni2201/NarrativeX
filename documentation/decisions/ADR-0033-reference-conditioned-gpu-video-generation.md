# ADR-0033: Reference-conditioned GPU video generation and residency boundary

## Status

DEFERRED / NOT IMPLEMENTED


## Date

2026-09-18

## Context

Short-video generation for NarrativeX requires rendering dynamic scene video clips conditioned on locked character visual references, keyframe imagery, and storyboard scene pacing.

The target dedicated deployment environment is a remote worker equipped with a single NVIDIA GeForce RTX 3090 (24GB VRAM). A single 24GB VRAM card cannot concurrently hold multi-billion parameter image diffusion models (e.g. FLUX/SDXL), text LLMs (Qwen), speech models (VoiceStudio/WhisperX), and open-source video diffusion models in active GPU memory without experiencing out-of-memory (OOM) failures or excessive paging thrash.

Furthermore, architectural boundaries established in ADR-0012, ADR-0028, ADR-0029, and ADR-0030 must be preserved:
1. Spring Boot is the single control plane orchestrating business logic and durable jobs.
2. `generation-service` is domain-neutral and accepts only capability-backed `ComputeTask` payloads without database credentials or domain IDs (`projectId`, `chapterId`, `sceneId`).
3. Desktop (`app/desktop` Electron + FFmpeg) retains exclusive ownership of timeline composition, audio track mixing, and final project video rendering. The GPU service never renders audio or final composited video files.

## Decision

### 1. Compute Protocol Boundary (`video.generate`)

Video generation is introduced to the Compute Protocol v1 specification as action type `video.generate`.

- **Input Contract:**
  - `prompt`: Textual description of visual motion and dynamics.
  - `duration_seconds`: Target clip duration (typically 2 to 5 seconds per visual beat).
  - `fps`: Clip framerate (default 24 or 25 fps).
  - `resolution`: Target dimensions for vertical video (e.g. `540x960` or `720x1280` in 9:16 aspect ratio).
  - `first_frame_artifact`: Capability-backed URI to the starting image frame.
  - `reference_image_artifacts`: Capability-backed URIs to locked character appearance references.
  - `seed`: Deterministic generation seed integer.
  - `motion_bucket_id` / `motion_scale`: Normalized motion intensity factor.

The payload strictly forbids business identifiers (`projectId`, `chapterId`, `sceneId`, `characterId`). Output is returned as an opaque capability-backed video artifact reference (MP4 or WebM clip).

### 2. Model Evaluation and Offloading Strategy

For 24GB VRAM execution, Wan 2.1 (I2V / T2V) and HunyuanVideo were evaluated:
- **Wan 2.1 (14B / 1.3B):** Chosen as the primary open-weights target due to superior image-to-video (I2V) conditioning fidelity, manageable context scaling, and community-proven 4-bit/8-bit GGUF and NF4 quantization paths under 24GB VRAM.
- **HunyuanVideo:** Retained as an alternative backbone for text-to-video, but requires aggressive CPU parameter offloading on a single 24GB GPU, resulting in higher latency.

To ensure stability on a single RTX 3090:
- Video diffusion is executed in quantized precision (FP8 / NF4 / GGUF) using ComfyUI workflow execution or dedicated diffusers runtime adapters.
- FlashAttention-2 / SageAttention is enabled where supported.
- Resolution defaults to 540x960 (9:16) for responsive previews and scales to 720x1280 for production clip exports.

### 3. GPU Runtime Residency Management

Because multiple generative families cannot reside in 24GB VRAM simultaneously, `generation-service` introduces a host-level `GpuResidencyManager` governed by `RuntimeResidencyPort`:
- Explicit runtime families: `NONE`, `QWEN`, `COMFYUI_IMAGE`, `VOICESTUDIO`, `WHISPERX`, `COMFYUI_VIDEO`.
- Tasks declare their required `RuntimeRequirement` on their respective `ExecutorPort`.
- Mutual exclusion: Only one active GPU runtime family may hold GPU resources at any time.
- Transition lifecycle: When a task requires a different family, the manager safely shuts down or unloads the active runtime, waits for OS/process VRAM reclamation, and only then initializes the target runtime.
- **Fail-Closed Semantics:** If the prior runtime fails to terminate or release VRAM within a configured transition timeout (default 30 seconds), the transition fails immediately and subsequent tasks are rejected. The manager never allows conflicting models to execute simultaneously.

### 4. Audio and Assembly Invariant

The GPU server produces isolated, silent video clips. Narration audio synthesis, speech alignment, subtitle burns, transition effects, background audio leveling, and final container muxing are strictly performed locally on Desktop by Electron and FFmpeg. The GPU server never accesses project audio or produces final video exports.

## Consequences

### Positive
- Enables high-quality generative video clips on affordable single-GPU (RTX 3090 24GB) hardware.
- Prevents OOM crashes through deterministic, fail-closed runtime residency management.
- Maintains strict domain separation: GPU service remains an unprivileged stateless execution worker.
- Preserves local-first project integrity and offline rendering capability on the Desktop editor.

### Negative
- Switching between image, speech, and video runtimes incurs a warm-up / cold-start latency penalty on single-GPU deployments.
- High VRAM quantization restricts fine-tuning flexibility compared to multi-GPU clusters.
