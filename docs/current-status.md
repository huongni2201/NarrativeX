# Current Status

Records the gap between code and direction. Code, migrations and tests establish implementation facts; accepted ADRs establish direction. An accepted ADR, a plan or a passing fixture does not promote a target. Labels: **IMPLEMENTED**, **PARTIAL**, **TARGET**, **DEFERRED**.

Capability-level detail (the full matrix) is in the [product specification](product/product-spec.md). This page records what was last verified and where the repository disagrees with itself.

## Last verification (2026-10-21, Windows)

| Area | Command | Result |
|---|---|---|
| Backend | `./mvnw.cmd test` (includes Testcontainers PostgreSQL integration tests; Docker available) | 1003 tests, 0 failures |
| Generation worker | `python -m pytest`, `ruff check`, `mypy src` | 184 passed; lint and types clean |
| Desktop | `npm test`, `npm run type-check` | 532 tests, 0 failures; types clean |
| Backend formatting | `spotless:check` | Pre-existing violations remain in `ImageGenerationJobHandler`, `ComputeExecutionDispatcherTest` and the uncommitted take-QC files (`GetChapterProductionUseCase`, `TakeQualityEvaluatorTest`, `TakeQualityReadModelTest`) |
| Desktop native render | `node --test test/render-native-av-drift.integration.test.mjs` (bundled FFmpeg) | 30 trimmed cuts: video 80250 ms, audio 80271 ms, inside the 150 ms sync tolerance; per-segment AAC rounding does not accumulate |

Not verified: any Electron runtime flow, any real GPU generation, Compose deployment, upgrade of an installed database. Fixture and fake-provider success is not production health.

## Direction and implementation

| Area | Status | Evidence and gap |
|---|---|---|
| Single-user local-first, Project boundary (ADR-0001) | IMPLEMENTED | No account, session or owner attributes in domain, schema or IPC. |
| Compute Protocol v1, durable dispatch, callbacks, reconciliation (ADR-0003) | IMPLEMENTED foundation | Intent persisted before I/O; UNKNOWN fencing. GPU round trips not runtime-verified here. |
| Story structure and source anchoring (ADR-0006) | IMPLEMENTED foundation | Unit-anchored analysis contracts 1.2 and 1.3 are present; PostgreSQL and runtime acceptance of staged analysis pending. |
| Chapter Analysis through the user's `agy` CLI (ADR-0009) | PARTIAL | Isolation spike passed on agy 1.3.5; real chapter completion pending. |
| Prompt Settings (ADR-0010, Proposed) | PARTIAL | Backend done; Desktop runtime unverified. |
| Narration: VieNeu TTS and WhisperX alignment (ADR-0007) | PARTIAL | Finalizer now registers the WAV (`project_assets`, `narration_assets`, duration read from the header, 48 kHz mono PCM16 enforced) and admits a durable `audio.align` job (`narration-align:<audioId>`) that stores `whisperx-forced-v1` words; regeneration replaces the audio and drops the stale alignment. PostgreSQL-tested with a stubbed worker; **no real TTS or WhisperX run**, the worker `audio.align` output has not been seen end to end, and a failed alignment has no retry UI. |
| Video-first Shot / Take / SelectedTake (ADR-0008) | IMPLEMENTED foundation | Active profile `video.generate:1.1`: text-to-video, 1280×720, 24 FPS, 16:9, native AV, `DIALOGUE` cues only. |
| Take review and cue ownership | PARTIAL | Human review checklist and `shot_audio_cue_allocations` implemented with tests; Electron runtime and PostgreSQL gates remain. |
| VisualBeat image attempts and explicit image selection | PARTIAL | Admission, review, selection and finalizer unit-tested; GPU worker, callback round trip and Electron flow unverified. |
| Automatic take QC, tier 1 (advisory) | PARTIAL | Worker scorer, contract, backend storage, evaluator and read model tested; Desktop QC panel and filter implemented but **not runtime-verified**; thresholds uncalibrated. |
| Local media, Desktop final render, render snapshots (ADR-0004, ADR-0005) | IMPLEMENTED foundation | Schema 3/4 snapshots; Electron renders, backend stores metadata only. |
| Audio-first, keyframe-conditioned production with multi-track render | TARGET | [Video quality pipeline](plans/20261020-video-quality-pipeline.md) P0–P14. Only P1 has started: P1.1–P1.4 done (scorer `FFMPEG_TAKE_QC_V2`, thresholds `TAKE_QC_THRESHOLDS_V2`, speech expectation read from each Take's own snapshot); P1.F1 In/Out reset fixed; P1.5 unverified at runtime against the real API (only a fixture harness was exercised); P1.6 open; P0 gate not passed. P2–P14 not started. |
| I2V, First/Last frame, reference conditioning, `AUDIO_FIRST` | TARGET | Rejected by preflight before a Take or job exists; the strategy enum is not executor readiness. |
| Retention engine, Shot/Editing Director, automatic regeneration | DEFERRED | Need their own ADR (ADR-0008 items 10–11). |

## Known drift

- **Take and Shot lifecycle.** Every path that ends a job in FAILED or CANCELED now closes its open Takes (`MyBatisGenerationJobPersistenceAdapter`), and `shots.status` is derived from Takes and the saved selection (`TakeMapper.refreshShotStatus`) instead of being set by hand: QUEUED, GENERATING, VALIDATING, MANUAL_REVIEW, FAILED, with a saved selection always SELECTED. A batch leaf whose Take failed validation is FAILED, not READY. PostgreSQL-tested; Electron runtime unverified.
- **Unusable worker output.** A finalizer that receives a success it can never accept (missing artifact, narration not 48 kHz mono PCM16, invalid alignment) throws `InvalidComputeOutputException` before writing anything. The callback and reconciliation paths fail the job with `COMPUTE_OUTPUT_INVALID` instead of rolling back and re-reconciling forever.
- **Frozen snapshots only.** `VideoGenerationJobHandler` no longer builds a default-prompt request for a job without an admitted Take snapshot; such a job fails closed with `VIDEO_LEGACY_INTENT_UNSUPPORTED`.
- **Native render is Project-wide.** One chapter with Shots switches the whole Project to native cuts, so a chapter without selected Takes blocks the render; the admission error now names those chapters.
- **Narrator cues.** The native profile still rejects NARRATOR, INNER_MONOLOGUE and SYSTEM cues, so stories with a narrator cannot generate video until the audio-first work (TARGET).
- **Editor preview.** Native preview drives the playhead from a timer while the `<video>` plays independently (resync only beyond 0.3 s); it is not a faithful preview of the hard-cut render. Not changed, because it cannot be verified without Electron.
- **Active audio path is native AV.** `LTX_NATIVE_AV`, `NativeDialogueDurationEstimator` and the `1.1` profile are the only working video path. The target architecture replaces them for new Projects, but no replacement exists yet, so none of that code is removable today.
- **Strategy text versus profile.** `VideoQualityAssurance.recommendRetryAction` suggests `FIRST_LAST_FRAME`, `VIDEO_EXTEND` and `IMAGE_TO_VIDEO`, which the active profile rejects. The text is advice only, but it can point the editor at an unavailable route.
- **Migrations.** `V17`–`V19` exist beyond the squashed `V1`–`V7`; whether an installed database applied them is not established. See [database](architecture/database.md).
- **Compose and environment templates** are migration-sensitive and were not verified in this pass. Do not claim deployment readiness from them.
- **Stale tooling worktree.** `.claude/worktrees/silly-bell-aa2cfb` is a registered Git worktree (about 211 MB) on branch `claude/silly-bell-aa2cfb`, with uncommitted changes. It is not part of the product and was left untouched.

## Read next

[Documentation map](README.md) · [ADR index](decisions/README.md) · [Active plans](README.md#active-plans)
