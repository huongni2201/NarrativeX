# Desktop audio workspace

**IMPLEMENTED:** Audio is a top-level project section beside Chapters, Canon, Editor, Assets and Jobs. The existing Electron/preload/backend boundaries are unchanged ([ADR-0004](../decisions/ADR-0004-desktop-client-boundary.md)).

## Navigation

`/projects/:projectId/audio` opens **Giọng nhân vật**. Query parameter `tab` selects `characters`, `narration` (**Lời kể**), `vieneu` (**Giọng VieNeu**) or `library` (**Thư viện giọng**). `characterId` selects a participating Character. Browser back/forward restores the selected tab; switching audio tabs preserves the current voice form draft, narrator selection and library filters.

Canon contains Characters and Continuity. Character details link to the selected character's voice form. A `MISSING_VOICE_PROFILE` production blocker links to character voices. Legacy `/projects/:projectId/voices` and `/canon?tab=voices` redirect to the audio library and preserve other query parameters. Sidebar shortcuts follow visual order: Ctrl/Cmd+1 Chapters, +2 Canon, +3 Audio, +4 Editor, +5 Assets, +6 Jobs.

Audio loads project chapters through the authoritative timeline/story-version query, participating characters, the voice catalog and audio assets. Canon no longer loads the voice catalog or chapter list for the removed voice tab.

## Character voice profiles

`GET /api/v1/characters/{characterId}/voice-profiles` returns the Character row version, pinned profile ID and version history. `POST` to the same collection creates an ACTIVE text-conditioned voice profile and pins it atomically. Input: required `expectedRowVersion`, `language` (1–16 characters), `voiceDescription` (1–2,000 characters); optional `accent` (at most 64) and `deliveryBaseline` (at most 2,000).

The backend locks the Character before allocating the next version. A stale row version returns 409 without creating a profile. Archived/missing Characters return 404. Existing profiles, including locked ones, are preserved. Saving a profile does not execute AI, synthesize audio or require reference audio. Character identity is reusable across projects, so its pinned voice applies wherever that Character participates; the form explains this. Existing generation snapshots remain frozen.

Desktop invalidates the Character voice query, project views and video-production queries after saving. Current voice resolution follows the backend: pinned profile first, otherwise latest ACTIVE; a pinned inactive profile cannot silently fall back to a different voice. A description is required for voice readiness.

## Narration and library

The narrator and Character voice identities are separate. **Lời kể** selects a chapter, narrator preset and speaking rate, then uses the existing narration admission APIs. The library retains filtering, sample playback, project-local audio imports, reusable local reference selection and preview. These actions still use existing typed preload/media workflows and backend admission. This UI change does not establish provider or GPU readiness ([ADR-0007](../decisions/ADR-0007-narration-tts-and-alignment.md)).

**DEFERRED:** selecting an older Character voice version, assigning a reference recording to a Character profile, automatic voice descriptions and voice cloning controls. The new Character form creates descriptive voice versions only.


## VieNeu voices and custom voices

**IMPLEMENTED (isolated browser fixture and PostgreSQL HTTP tests; no Electron or GPU runtime evidence):** `?tab=vieneu` (**Giọng VieNeu**) lists VieNeu catalog voices in two groups: **Giọng của bạn** (custom) and **Giọng có sẵn của VieNeu** (default plus presets, featured first, with region when known). It reads the same `GET /api/v1/voices` catalog as the library; gender is shown only when the catalog has it.

`POST /api/v1/voices/custom` creates a catalog voice. Input: `name` (1–64 characters, unique among enabled VieNeu voices ignoring case, otherwise 409), `referenceAssetId` (a READY global voice reference; otherwise 400/404), optional `language` (default `vi-VN`), `gender` (`MALE|FEMALE|NEUTRAL`) and `description` (at most 500). `DELETE /api/v1/voices/custom/{id}` disables only custom voices (404 for presets or the default); the reference recording is kept. Desktop uploads the recording through the existing voice-reference flow, waits for READY, then creates the voice.

VieNeu keeps enrolled voices in process memory only, so the backend catalog is the source of truth and each synthesis clones from the stored reference ([compute protocol](compute-protocol.md)). Selecting a custom voice on **Lời kể** therefore needs no separate reference selection; an explicit reference still overrides it. Custom voices are installation-wide, like the catalog.

**Known limits:** the voice-reference upload could not be completed on an isolated local backend run during development (`UPLOAD_VERIFICATION_FAILED` on finalize; the extensionless `voices/uploads/<id>` key makes the stored content type differ from `audio/wav`) — this predates the change and is unverified on the Docker stack. Real VieNeu synthesis with presets and cloned voices, and the `/generate` reference endpoint the worker client calls, remain unverified. Voices cannot yet be previewed from this tab.

## Verification

PostgreSQL HTTP integration tests cover create/pin, version history and locked-profile preservation, speaker resolution, stale editors, invalid input and archived/missing Characters. An isolated browser fixture covers saving, keeping the draft on a rejected save, audio tab navigation, narration selection, library empty/error states and absent sample audio. Production runtime evidence must be recorded separately from fixture results.

**Verified 2026-10-16:** backend 829 tests passed, zero skipped; Desktop 484 passed, 11 skipped, with the audio browser fixture run separately and passing. Type-check, build, dependency lock, scoped Java formatter check and `git diff --check` passed. The migration inventory remains V1–V7; this feature has no schema change.

Real Electron connected to the local backend verified all three tabs, form read/reset and draft preservation, narration chapter selection, library filtering and absent sample feedback, Canon/production links, legacy redirects, back/reload, and dark/light layouts at 1180px. No JavaScript/console errors, failed renderer requests or horizontal overflow were observed. Screenshots: `.runtime/audio-workspace-characters.png`, `.runtime/audio-workspace-narration.png`, `.runtime/audio-workspace-library.png`, `.runtime/audio-workspace-light-1180.png`. Runtime verification did not assign invented voices to project Characters or execute synthesis; profile persistence is covered by the real PostgreSQL HTTP integration and isolated UI fixture.
