# Cinematic production implementation ledger

Plan: [LTX production](LTX_PRODUCTION_IMPLEMENTATION_PLAN.md), extended by the user's cinematic architecture on 2026-09-20.

## Binding design

- Preserve Project/StoryVersion/Chapter/Scene/StoryBeat/{AudioCue,VisualBeat}; add shot sequences beneath VisualBeat, not a replacement hierarchy.
- English native LTX audiovisual generation is preferred. Voice profiles maintain broad perceived age, accent and timbre, not exact cloning. Final timing requires approved actual audio; provisional plans never imply render readiness.
- Retention maps/hook/payoff and attention events express editorial intent, not predicted retention. Ground every change in source; warnings should not force cuts or unnecessary camera movement.
- Every shot has purpose, action/start/end state, camera/subject/world motion and character references. A locked camera is legitimate; artificial camera motion is not a substitute for moving footage.
- Routing is capability-gated: unsupported first/last, multi-keyframe, extension or retake must block rather than silently substitute. Keep profiles immutable and retries backend-owned, max two automatic retries.
- Use existing generation lifecycle, PostgreSQL authority and local artifact boundaries. Never add fake production health, direct GPU business orchestration, arbitrary workflow submission or default publishing.
- Budget ceiling remains 100,000 VND/run; rental release and real quality/performance validation require actual provider/runtime evidence.

## Execution tasks

- [ ] Backend: versioned cinematic planning model, retention/hook validation, shot/take/edit/QA planning and durable project-scoped API using existing boundaries.
- [ ] Worker: video.generate contracts, capability-gated LTX adapter, durable ComfyUI lifecycle, native audio output and focused tests.
- [ ] Render: propagate 24 FPS through current backend/contracts/Desktop without breaking 30/60 snapshots; verify tests and native rendering where available.
- [ ] Integrate Gemini director guidance, documentation and contract compatibility; preserve source anchoring and English voice requirements.
- [ ] Verify independent quality gates, review changes, address findings and record runtime blockers.

## Rulings

- The user explicitly requested implementation of the supplied architecture. Proceed with reversible implementation rather than request another design approval.
- Work stays in the existing workspace on codex/cinematic-production to preserve the previously created uncommitted plan and documentation map.
- Implement separate modules inside the monolith, not nine services. YouTube feedback initially accepts explicit imported observations; insights are hypotheses, never automatic causal conclusions or auto-publishing.
- Real GPU benchmarks and paid external calls are not evidence available from unit tests. Report missing environment/credentials explicitly; no model speed or voice quality promises.

## Verification

Pending implementation.
