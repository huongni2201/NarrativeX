# Video-First Runtime Execution Flow

**Status:** Authoritative Runtime Specification  
**Authority:** ADR-0026, ADR-0027, ADR-0029, ADR-0030  
**Date:** 2026-09-20  

---

## 1. Sequence Overview

The runtime executes in four discrete phases:
1. **Narrative & Retention Planning** (Backend + Vertex Gemini)
2. **Shot Preparation & Generation Routing** (Backend + Auxiliary Reference Engine)
3. **GPU Video Compute & Quality Assurance** (GPU Worker + LTX-2.5 + QA Validator)
4. **Take Selection, Editing & Local Assembly** (Desktop Editor + Local FFmpeg)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Desktop Video Shotboard
    participant BE as Backend Control Plane
    participant Gemini as Vertex Gemini 3.8
    participant Worker as GPU Worker (LTX)
    participant Local as Electron FFmpeg

    Note over UI,Gemini: Phase 1: Planning
    UI->>BE: Plan Chapter Narrative (chapterId)
    BE->>Gemini: Request Story Analysis, HookPlan, RetentionMap
    Gemini-->>BE: Typed StoryPlan (Dramatic Beats, Retention Roles)
    BE->>Gemini: Request Shot Sequence Planning
    Gemini-->>BE: Typed ShotSequences & Shots
    BE->>UI: Broadcast Planning Complete (SSE)

    Note over UI,Worker: Phase 2 & 3: Generation & QA
    UI->>BE: Generate Shot (shotId)
    BE->>BE: GenerationRouter.route(shot)
    BE->>Worker: Submit ComputeTask (video.generate, strategy, prompt, refs)
    Worker->>Worker: Execute LTX-2.5 Pipeline
    Worker-->>BE: Callback Task Completed (artifactRef)
    BE->>BE: VideoQA.validate(take)
    alt Validation Passed
        BE->>BE: Create Take(status=PASSED), Set Default SelectedTake
    else Validation Failed
        BE->>BE: Create Take(status=FAILED, failureReason)
        BE->>BE: Apply Reason-Aware Retry Policy
    end
    BE->>UI: Broadcast Shot State Updated (SSE)

    Note over UI,Local: Phase 4: Editing & Render
    UI->>BE: Adjust SelectedTake / In-Out Trim
    UI->>BE: Request Edit Decision List (chapterId/projectId)
    BE->>BE: EditingDirector.compile(SelectedTakes, AudioClock)
    BE-->>UI: EditDecisionList (EDL)
    UI->>Local: Execute FFmpeg Render (EDL, Narration, Subtitles)
    Local-->>UI: Render Complete (Final 720p/24 MP4)
```

---

## 2. Invariants

1. **Persist Intent Before I/O**: Every shot generation request writes a `Take` record in state `SUBMITTING` with an idempotency key before dispatching tasks to the GPU worker.
2. **No Direct Timeline Admission**: Generated video clips never appear in the edit decision list without passing `VideoQA` validation and explicit `SelectedTake` binding.
3. **Decoupled Durations**: The duration of moving footage produced by generative models (`sourceDurationMs`) is independent of the edit duration assigned on the narrative master clock (`timelineDurationMs = sourceOutMs - sourceInMs`).
4. **Idempotent Retries**: Retries must increment `attemptNumber` and record the specific failure reason. If the retry limit (default 2 retries, 3 total attempts) is reached, the shot transitions to `MANUAL_REVIEW`.
