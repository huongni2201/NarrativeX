# Multi Gemini Browser Pool Design

Date: 2026-09-01
Amended: 2026-09-02
Status: implemented; real Chrome runtime verification pending

## Goal

NarrativeX Desktop owns a user-manageable pool of Gemini Chrome profiles while preserving one browser as the default. A user can add independent browser profiles, sign into Google/Gemini directly inside each Chrome profile, keep those Chrome-owned sessions across app restarts, and let NarrativeX distribute image-generation work across browsers the user has explicitly confirmed as signed in.

NarrativeX never stores Google credentials and no longer infers Google authentication state from the Gemini DOM.

## Current Defaults

- Character parallel tabs: 2.
- Storyboard parallel tabs: 4.
- Allowed range for each: 1-8.
- Concurrency values are global per NarrativeX user, not multiplied by browser count.
- Every user starts with exactly one `Browser 1` entry.

## Browser Architecture

Each browser entry represents one isolated browser root containing its own Chrome profile, automation session, CDP port and downloads:

```text
gemini-web/
  users/
    <narrativex-user-key>/
      browsers/
        <browser-id>/
          chrome-profile/
          session.json
          lanes/
            character/downloads/
            storyboard/downloads/
```

The filesystem user key is a deterministic hash of the NarrativeX user id. Two browser entries never share a `chrome-profile` directory or remote-debugging port.

Within one browser process NarrativeX may own several reusable Gemini targets. The browser pool composes that existing tab/slot model instead of replacing it.

## Browser Registry Model

Per-user Desktop preferences persist only NarrativeX-owned browser metadata:

```ts
interface GeminiBrowserProfile {
  id: string;
  name: string;
  createdAt: string;
  loginConfirmed: boolean;
}
```

`loginConfirmed` is a user assertion, not a live Google authentication measurement. New and migrated entries default to `false` unless the user explicitly confirms them. Browser names default to `Browser 1`, `Browser 2`, and so on. At least one browser entry must always remain.

Chrome cookies, local storage and Google session state stay exclusively inside each browser's `chrome-profile` directory and never enter Desktop preferences or renderer state.

## Login and Manual Confirmation

The supported flow is deliberately explicit:

1. The user presses `Open` for a browser entry.
2. Only `Open` may start or foreground that Chrome profile.
3. The user signs into Google/Gemini directly in Chrome if necessary.
4. Back in Settings, the user presses `I'm logged in`.
5. NarrativeX persists `loginConfirmed = true` and allows that browser to participate in generation scheduling.
6. The user can later press `Mark logged out` to set the flag back to `false` without deleting Chrome profile data.

NarrativeX does not inspect Gemini composer selectors, account menus, page text or other DOM details to determine whether Google considers the profile authenticated. This avoids coupling Settings state to Gemini UI changes.

If Google later expires or revokes the Chrome session while `loginConfirmed` is still true, the next provider operation may fail normally. The user can `Open` the browser, sign in again and continue. This design intentionally treats the user confirmation as scheduling eligibility rather than a guarantee about provider-side session validity.

## Settings UI

The Gemini Browsers section shows each browser with one of two persisted states:

- `Login confirmed`.
- `Login not confirmed`.

Actions:

- `Open`: opens/foregrounds only the selected Chrome profile.
- `I'm logged in`: marks an unconfirmed browser confirmed.
- `Mark logged out`: removes scheduling eligibility without deleting Chrome data.
- `Reset login`: stops the selected host, deletes only its saved Chrome login/session data and clears `loginConfirmed`.
- `Remove`: deletes a removable browser entry and only that browser's local automation data.
- `Add browser`: creates a new isolated entry with `loginConfirmed = false`.

Opening Settings or refreshing the list only reads persisted browser metadata and active-lease counts. It never starts Chrome and never probes the Gemini page to determine login status.

## Generation Concurrency

Character and Storyboard concurrency remain global per-user limits.

Example:

```text
2 confirmed browsers
Character parallel tabs = 2
Storyboard parallel tabs = 4
```

The entire pool still allows at most two Character generations and four Storyboard generations concurrently. Browser count does not turn 4 Storyboard slots into 8.

The scheduler chooses among browsers with `loginConfirmed = true`, favors the least-active host and rotates equal-load choices. If one confirmed browser carries more work, the split may be 3+1 rather than a hard-coded 2+2. If only one browser is confirmed, that browser may consume all available global slots.

An already-submitted generation is never silently replayed on another browser after failure because that could create duplicate or ambiguous Gemini results.

## Browser Host Lifecycle

```text
GeminiBrowserSession
  - Chrome process/profile lifecycle
  - persisted CDP port
  - control target
  - Open/foreground behavior
  - stop lifecycle

GeminiBrowserHost
  - browser id
  - host-local reusable Gemini automation pool
  - active generation lease accounting

GeminiBrowserPool
  - per-user browser registry
  - host creation/removal
  - manual-confirmation eligibility
  - least-active/round-robin routing
  - global lane concurrency
```

`GeminiBrowserSession` intentionally contains no `authStatus`, login polling or DOM auth classifier. Browser login confirmation belongs to preferences and user actions, while Gemini page automation remains focused on generation.

## Persistence and Reset Semantics

- `Reset Gemini generation settings` resets Character/Storyboard concurrency overrides but preserves browser registry and confirmations.
- `Reset all personalized settings` preserves browser registry/profile login data rather than silently destroying Chrome sessions.
- `Mark logged out` changes only `loginConfirmed`.
- `Reset login` stops the selected browser, removes its local Chrome login/session data and sets `loginConfirmed = false`.
- `Remove` deletes only the selected additional browser and its local browser data.
- Browser profile data is device-local and user-local; there is no backend/PostgreSQL migration.

## IPC / Renderer Boundary

Trusted browser-management operations are:

```ts
geminiWeb.browsers.list()
geminiWeb.browsers.add()
geminiWeb.browsers.open(browserId)
geminiWeb.browsers.setLoginConfirmed(browserId, loginConfirmed)
geminiWeb.browsers.resetLogin(browserId)
geminiWeb.browsers.remove(browserId)
```

The old automatic `login(browserId)`/auth-probe operation is removed.

Generation remains browser-agnostic. Renderer code never receives Chrome profile paths, CDP ports, cookies, tokens or Google credentials.

## Error Handling

- No browser confirmed: generation returns a clear instruction to open a browser, sign into Gemini and confirm it in Settings.
- Provider session expired despite confirmation: the provider operation fails normally; NarrativeX does not silently change confirmation state or retry through another browser.
- Browser start/CDP failure during `Open`: surface the Chrome/CDP error for that browser only.
- Removing/resetting an active browser: reject until its active generation leases finish.
- Missing/corrupt profile data: explicit Reset Login can recreate only that browser's local state.
- One browser crashes: sibling browser profiles remain isolated.

## Migration

Existing single-browser local data is adopted as `Browser 1` using the existing allowlisted, idempotent migration for `chrome-profile`, `session.json`, `lanes` and `slots`. Existing target files are never overwritten and unknown legacy files are left untouched.

Because NarrativeX no longer infers provider authentication, a browser registry entry without the new `loginConfirmed` property migrates to `false`. Existing Chrome cookies are preserved; the user only needs to press `I'm logged in` once to make that browser eligible for scheduling.

## Testing

Automated coverage requires:

1. Fresh Browser 1 is unconfirmed.
2. New browsers are unconfirmed and receive unique ids.
3. Manual confirmation survives preference sanitization/persistence.
4. Browser list reflects persisted confirmation without invoking Chrome auth probing.
5. Scheduler excludes unconfirmed browsers.
6. Global Character/Storyboard concurrency does not multiply with browser count.
7. Equal-load confirmed browsers can both receive work.
8. Generation failure is not replayed on another browser.
9. Only `Open` owns browser startup/control-target creation.
10. Browser session/host contain no automatic auth classifier, `authStatus()` or login polling.
11. Reset Login clears confirmation and affects only the selected browser data.
12. IPC/preload expose manual confirmation without Chrome secrets.
13. Settings expose `I'm logged in` and `Mark logged out` and no automatic browser-login command.
14. Existing Desktop tests, TypeScript checks and Electron production build remain green.

Real runtime verification still requires a GUI-capable Windows/Desktop environment: open Browser 1 and Browser 2, sign into each desired Google account, confirm both in Settings, restart NarrativeX, verify confirmations and Chrome-owned sessions persist, then exercise concurrent generation and per-browser reset behavior.

## Out of Scope

- Detecting Google/Gemini login by DOM inspection.
- Storing Google email/password, cookies or OAuth refresh tokens in NarrativeX preferences.
- Backend-synchronized browser profiles.
- Syncing browser login state across devices.
- Automatic Google account creation.
- Browser renaming.
- Per-job manual browser selection.
- Automatically increasing global concurrency when a browser is added.
- Silent retry of an already-submitted Gemini prompt on another browser.

## Success Criteria

A fresh user has one unconfirmed Gemini browser by default, can add additional isolated browsers, can explicitly open and sign into each Chrome profile, can manually confirm or revoke scheduling eligibility, and generation automatically balances work only across confirmed browsers while preserving the configured global concurrency limits. Settings and refresh operations never infer login state from Gemini DOM and never open Chrome implicitly.
