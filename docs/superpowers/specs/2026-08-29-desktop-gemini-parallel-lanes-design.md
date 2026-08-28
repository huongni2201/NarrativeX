# Desktop Gemini Parallel Lanes Design

Date: 2026-08-29
Status: approved

## Goal

Allow Character identity generation and Storyboard image generation to run independently through two Gemini Web tabs without requiring two Google sign-ins or allowing prompts, downloads, network captures, busy state, or queue progress to cross feature boundaries.

The change must also make Storyboard Generate All progress reflect durable image persistence immediately. A cache refresh failure must not leave an attached image at `0%`, keep the focus border on the completed beat, or cause that beat to be generated again.

## Selected Architecture

Electron main owns one visible Chrome process with one dedicated NarrativeX Chrome profile and loopback CDP port. Inside that process it owns two logical automation lanes:

- `CHARACTER`: one dedicated Gemini tab for Character identity references.
- `STORYBOARD`: one dedicated Gemini tab for individual Storyboard images and Storyboard Generate All.

Each lane has its own target identity, active-generation lock, CDP connection, network tracker, download directory, and capture baseline. The lanes may generate concurrently. Requests within the same lane remain serialized and return a lane-specific busy error when duplicated.

The lanes share only the Chrome process, profile, authenticated Gemini session, and process lifecycle. They do not share a Gemini page target, generation state, download namespace, or active flag.

## Typed Lane Contract

The renderer-to-preload input for Gemini image generation gains a required lane discriminator:

```ts
type GeminiWebLane = "CHARACTER" | "STORYBOARD";

interface GeminiWebGenerateImageInput {
  lane: GeminiWebLane;
  projectId?: string;
  prompt: string;
  references?: GeminiWebReferenceInput[];
}
```

Character reference generation always sends `CHARACTER`. Storyboard generation always sends `STORYBOARD`. Electron main validates the discriminator and routes the request to the matching lane before resolving references or submitting the prompt. Unknown or missing lanes are rejected; there is no default lane that could silently route a request incorrectly.

Selection tokens remain sender-bound, operation-bound, short-lived, and single-use. A staged selection records its lane for diagnostics and to prevent a future commit path from accepting a mismatched lane if commit semantics expand.

## Chrome and Tab Lifecycle

A shared Chrome host owns executable discovery, profile startup, CDP port discovery, and shutdown. It must not create two Chrome processes against the same profile, which would introduce profile-lock failures.

The host maintains a target ID per lane. When a lane starts work it:

1. Reuses the lane's live target when the target still exists.
2. Rehydrates the persisted target ID when Electron restarts while the NarrativeX Chrome process remains alive.
3. Creates a new Gemini tab only for the missing lane when the target is absent or closed.
4. Never selects an arbitrary first `gemini.google.com` target.

Persisted Chrome session metadata includes the CDP port and optional target IDs for both lanes. Stale target IDs are discarded independently. Recreating the Character tab must not navigate or reset the Storyboard tab, and vice versa.

Each lane uses a distinct directory beneath the shared automation root:

```text
gemini-web/
  chrome-profile/
  session.json
  lanes/
    character/downloads/
    storyboard/downloads/
```

Network capture remains scoped to the lane's CDP target. Fallback download discovery reads only that lane's directory.

## Concurrency and Isolation

`CHARACTER` and `STORYBOARD` have independent active flags. The following is allowed:

```text
Character tab:  generate identity A ───────────────┐
Storyboard tab: generate beat 4 ───── generate beat 5 ─────
```

Two simultaneous Character requests are rejected by the Character lane. Two simultaneous Storyboard submissions are rejected by the Storyboard lane. A Character request never waits behind or becomes part of the renderer-owned Storyboard queue.

Gemini account-side throttling or rejection is reported only to the lane that received it. NarrativeX does not retry a rejected request in the other lane.

## Storyboard Queue Ownership and Persistence

Storyboard Generate All remains a renderer-owned, project/chapter-scoped serial queue. It is not moved to PostgreSQL and does not become a backend durable job.

The queue may continue while the user navigates from Storyboard to Characters. Because `StoryboardScreen` unmounts during that navigation, queue state publication cannot depend solely on React component effects. Every state transition—running, current beat, completed, skipped, paused, and completed queue—must synchronously publish to the project/chapter local queue store as well as update mounted UI state.

When the user returns to Storyboard, the screen loads the latest published queue. The current border, generated/skipped counts, and percentage therefore reflect background progress rather than the state from the moment the screen unmounted.

Existing behavior remains:

- newly started queues exclude beats already `APPROVED`;
- resumed queues skip beats that became `APPROVED` after queue creation;
- Stop prevents submission of the next beat but does not promise cancellation of a prompt already submitted to Gemini.

## Mutation Success and Cache Refresh

Durable image persistence defines generation success. For Storyboard, success means the generated file was registered and committed to ProjectStorage and attached to the intended Visual Beat preview, plus production media selection when that timed beat exists.

React Query cache invalidation is a follow-up refresh, not part of the durable generation result. Storyboard, timeline, and asset-library invalidations run in a handled background task after persistence succeeds. A refresh failure is logged with lane/project/chapter context and may leave stale data until the next refresh, but it must not:

- reject an otherwise successful `mutateAsync` call;
- pause Generate All;
- keep the completed beat as current;
- leave progress unchanged;
- regenerate the same image on Retry & Resume.

After durable persistence returns, the runner marks the beat completed, publishes the queue, and selects the next pending beat. Border focus and percentage are derived from that published queue state.

Failures before durable persistence completes still pause the Storyboard queue at the failing beat. The existing Retry & Resume and Skip controls remain available.

## UI Behavior

No new browser editor or mock runtime is introduced. Existing Character and Storyboard screens keep their current controls.

- Character generation activity affects only the Character button/loading/notice state.
- Storyboard Generate All continues to show its queue banner and current-beat border.
- Running Character and Storyboard lanes may both show activity at the same time.
- Returning to Storyboard shows the most recently persisted queue state.
- Completed beats increment the generated count and progress bar before cache refresh finishes.

## Error Handling

- Missing lane: reject the IPC request as invalid input.
- Duplicate work in one lane: return a lane-specific `GEMINI_BUSY` message.
- Missing/closed lane tab: recreate only that lane's tab.
- Chrome unavailable or authentication required: surface the existing actionable Chrome/Gemini error to the requesting feature.
- Cache refresh failure after persistence: log and retain successful queue progress.
- Lane generation failure before persistence: fail only that lane; Storyboard pauses only for a Storyboard failure.
- Electron shutdown: stop the shared Chrome host once and close all lane CDP resources.

## Testing

Required automated coverage:

1. Preload and IPC contracts require and validate `CHARACTER` and `STORYBOARD`.
2. Character and Storyboard call sites send the correct lane.
3. Lane routing never falls back to an arbitrary lane.
4. Both lanes can be active concurrently.
5. A duplicate request is rejected only within its own lane.
6. Lane target restoration and recreation do not reuse the other lane's target.
7. Network capture and fallback download paths are lane-scoped.
8. Successful persistence remains successful when cache invalidation rejects.
9. A completed beat advances queue count, percentage, and current index.
10. Queue transitions persist while `StoryboardScreen` is unmounted and restore correctly when it remounts.
11. Approved beats remain excluded or skipped without generation.

Desktop runtime verification must exercise both lanes concurrently with real preload/main boundaries, inspect both Gemini tabs, return to Storyboard, and verify current border, progress, console errors, failed requests, and the generated images. If Electron automation remains unavailable, the change must be reported as runtime-verification blocked rather than visually complete.

## Documentation Impact

ADR-0021 is amended because its previous single-tab, globally serialized automation decision is replaced by two concurrent logical lanes under one Chrome host. No new backend service, microservice, broker, Redis dependency, provider SDK, or browser editor is introduced.

## Success Criteria

The design is implemented when Character and Storyboard can generate concurrently in separate Gemini tabs using one authenticated Chrome profile, prompts and captures cannot cross lanes, Storyboard progress advances immediately after durable persistence, and queue state remains accurate across navigation and restoration.
