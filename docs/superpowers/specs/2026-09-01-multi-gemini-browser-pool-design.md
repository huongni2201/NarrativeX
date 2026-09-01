# Multi Gemini Browser Pool Design

Date: 2026-09-01
Status: implemented; real Chrome runtime verification pending

## Goal

Extend NarrativeX Desktop from one persistent Gemini Chrome host to a user-manageable browser pool while preserving the current default behavior. Every NarrativeX user starts with exactly one Gemini browser profile. The user can add more browser profiles from Desktop Settings, sign into each profile independently, keep those Google/Gemini sessions across app restarts, and let NarrativeX distribute Gemini image-generation work across authenticated browsers without multiplying the configured global concurrency.

The feature must not store Google credentials. Authentication remains user-owned inside Chrome profiles.

## Current Baseline

PR #416 already introduces per-user Desktop preferences, Character and Storyboard concurrency settings, reusable Gemini slots, and one authenticated Chrome process/profile. The new browser pool builds on those boundaries rather than introducing a parallel settings or automation stack.

Current global defaults remain:

- Character parallel tabs: 2.
- Storyboard parallel tabs: 4.
- Allowed range for each: 1-8.
- Preferences are scoped to the active NarrativeX user on the current device.

## Selected Architecture

NarrativeX owns a per-user registry of Gemini browser profiles. A browser entry represents one independent Chrome process lifecycle, one dedicated Chrome user-data directory, one CDP endpoint, and one persisted automation session.

The default registry contains one entry:

```text
Browser 1
```

Users may add additional entries from Settings. Each browser entry is isolated from every other browser entry:

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

The filesystem user key is a deterministic hash of the NarrativeX user id so raw user ids are not embedded into browser-profile paths.

Two browser entries must never point at the same `chrome-profile` directory or the same remote-debugging port.

Within one browser process NarrativeX may still own multiple reusable Gemini page targets. The browser pool therefore composes the existing tab/slot model instead of replacing it.

## Browser Registry Model

Each per-user browser entry stores only NarrativeX-owned metadata:

```ts
interface GeminiBrowserProfile {
  id: string;
  name: string;
  createdAt: string;
}
```

Authentication state is not persisted as authoritative metadata. It is derived from the live Gemini page when needed.

The first browser is created automatically and is not removable while it is the only browser. Browser names default to `Browser 1`, `Browser 2`, and so on. Renaming is out of scope for this change.

Browser registry persistence belongs to the existing per-user Desktop preference/storage boundary, but browser lifecycle and Chrome profile management live in dedicated modules rather than expanding `desktop-preferences.ts` or `gemini-web-automation.ts` into multi-responsibility files.

## Authentication and Session Persistence

Each browser entry uses a dedicated Chrome `--user-data-dir`.

When the user presses `Login` for a browser that is not authenticated:

1. NarrativeX starts or reuses only that browser profile.
2. It opens or brings forward a Gemini page for that profile.
3. The user completes Google authentication directly in Chrome.
4. Cookies, local storage, and Google session state remain inside that browser's `chrome-profile` directory.
5. NarrativeX probes the page and changes the displayed status to `Logged in` only after the authenticated Gemini composer is available.

NarrativeX never captures, stores, proxies, or autofills the user's Google password.

Restarting NarrativeX reuses the same browser profile directory, allowing Chrome to restore the login session until Google expires, revokes, or re-verifies it.

## Authentication Status

The UI status is derived, not blindly trusted from a saved boolean.

Supported statuses:

- `Logged in`: Gemini authenticated UI/composer is available.
- `Not logged in`: Google/Gemini login or unauthenticated UI is detected.
- `Checking`: authentication probe is in progress.
- `Unavailable`: Chrome/CDP could not be started or queried.

Opening Settings may use a lightweight probe. Starting generation revalidates eligible browser hosts before submitting work so stale UI state cannot route a request into a logged-out profile.

## Settings UI

The existing Gemini settings area becomes two focused subsections.

### Gemini Browsers

Each browser appears as a card/row showing:

- browser display name;
- authentication status;
- `Open` when the browser exists and can be opened;
- `Login` when status is `Not logged in`;
- `Reset login` for an authenticated browser;
- `Remove` for removable additional browser entries.

The section ends with:

```text
+ Add browser
```

Adding a browser creates its registry entry and isolated profile root but does not require immediate login.

Removing a browser refuses while that browser owns active generation leases. Removal deletes that browser's registry entry and local browser automation data only after confirmation. At least one browser entry always remains.

### Generation Concurrency

The existing controls remain:

- Character parallel tabs.
- Storyboard parallel tabs.

These values remain global per-user concurrency limits, not per-browser multipliers.

Example:

```text
2 authenticated browsers
Character parallel tabs = 2
Storyboard parallel tabs = 4
```

The system still allows at most two Character jobs and four Storyboard jobs concurrently across the entire browser pool.

## Browser Pool Scheduling

The selected routing model is automatic pooling.

Generation callers do not select a browser. They continue to submit a lane and generation request through the existing IPC boundary. Electron main owns browser selection.

For each requested lane, the pool chooses an authenticated browser with available capacity. Scheduling favors the least-active ready host and rotates equal-load choices so one browser cannot permanently starve another.

The scheduler obeys both levels of limits:

1. Global user preference limit for the lane.
2. Capacity currently available across authenticated browser hosts.

If only Browser 1 is authenticated, behavior is functionally equivalent to the one-browser design.

Adding Browser 2 increases available isolation/capacity but does not automatically increase the user's configured Character/Storyboard concurrency values.

A browser that becomes logged out or unavailable is removed from eligible scheduling until it becomes healthy again. In-flight work already submitted to that browser fails only that lease/request; the pool does not silently replay the same generation on another browser because duplicate Gemini submissions could create ambiguous results.

## Browser Host Lifecycle

A dedicated browser host is responsible for one browser entry:

```text
GeminiBrowserHost
  - browser id
  - isolated browser root
  - login/auth session controller
  - host-local reusable Gemini automation pool
  - active generation lease accounting
```

A higher-level manager owns the collection:

```text
GeminiBrowserPool
  - browser registry
  - host creation/removal
  - eligibility/health
  - lane scheduling
  - global lease accounting
```

Chrome login/session control is implemented in focused `gemini-browser-session.ts` and `gemini-browser-cdp.ts` modules. The existing large Gemini page-automation implementation remains responsible for page generation within one host root rather than absorbing browser-registry, settings, cross-browser scheduling or login-management responsibilities.

The concrete host factory is wired at the Electron IPC composition root. `GeminiBrowserPool` itself depends on an injected host contract, keeping scheduler unit tests independent from the concrete Chrome/page-automation stack.

## Persistence Boundaries

Per-user Desktop preference data stores browser registry metadata and existing generation concurrency/window preferences.

Chrome-owned authentication data stays outside the JSON preference payload in each browser's `chrome-profile` directory.

No backend/PostgreSQL migration is required. Browser profiles are device-local and user-local.

Reset behavior:

- `Reset login` for Browser N: stop that host, delete Browser N's `chrome-profile` and automation session, preserve Browser N registry entry.
- `Remove` Browser N: stop host, remove registry entry, and delete that browser's local automation directories.
- Existing `Reset Gemini generation settings`: reset only global Character/Storyboard concurrency overrides; it does not erase browser logins.
- Existing `Reset all personalized settings`: reset window and Gemini concurrency personalization while preserving browser registry/profile login data. Browser login destruction is only available through the explicit per-browser Reset Login/Remove actions.

## IPC / Preload Contract

Typed browser-management operations live under the existing trusted Desktop bridge:

```ts
geminiWeb.browsers.list()
geminiWeb.browsers.add()
geminiWeb.browsers.open(browserId)
geminiWeb.browsers.login(browserId)
geminiWeb.browsers.resetLogin(browserId)
geminiWeb.browsers.remove(browserId)
```

All operations validate opaque browser IDs and remain sender-bound through the existing trusted IPC policy.

Generation IPC remains browser-agnostic. Renderer code never receives Chrome profile paths, CDP ports, raw session cookies or Google credentials.

## Error Handling

- Login window closed before authentication: remain not logged in; do not report success.
- Google requires re-verification: surface not-logged-in state and allow `Login` again.
- Browser start/CDP failure: show `Unavailable` with an actionable open/refresh path.
- Removing/resetting an active browser: reject until its generation leases are idle.
- Browser profile directory missing/corrupt: treat as unavailable/logged out and allow explicit reset; do not affect other browser profiles.
- One browser crashes: other browser hosts stay eligible.
- No authenticated browser available for generation: return a clear Gemini-login-required error rather than starting an unowned temporary profile.

## Migration from the Existing Single Browser

The existing current Gemini browser profile is adopted as the current user's `Browser 1` when possible so users do not intentionally lose their current Google login during this migration.

Migration is one-way and local:

1. If the browser registry is absent, schema migration creates Browser 1 metadata.
2. The browser-storage migration moves only allowlisted legacy automation entries (`chrome-profile`, `session.json`, `lanes`, `slots`) into Browser 1 when the destination entry is absent.
3. Existing destination entries are never overwritten.
4. Repeated startup calls become no-ops and preserve already migrated profile data.
5. Unknown legacy files are left untouched.

## Testing

Automated coverage includes:

1. A new user receives exactly one Browser 1 registry entry.
2. Browser additions receive unique stable IDs and isolated profile paths.
3. At least one browser must remain.
4. Browser user roots do not embed raw user ids.
5. Authentication status is derived from a probe, not persisted as authoritative `loggedIn` state.
6. Login succeeds only after authenticated Gemini UI is detected.
7. Browser profile/session roots are persistent and isolated.
8. Reset Login affects only the selected browser.
9. Browser data removal leaves sibling browser roots intact.
10. Existing single-browser profile migration to Browser 1 is idempotent and preserves profile data.
11. Global Character/Storyboard concurrency does not multiply with browser count.
12. Automatic scheduling distributes work only across authenticated browser hosts.
13. A failed submitted generation is not replayed on another host.
14. Generation IPC stays browser-agnostic and renderer cannot access profile paths/CDP/session data.
15. Settings owns browser actions through focused components rather than expanding the screen/main automation files.
16. Existing Desktop tests, TypeScript checks and production Electron build continue to pass.

Desktop CI #1127 passed the full Desktop `Test, type-check, and build` gate for the implemented source before this documentation-status update.

Real runtime verification still needs a Windows/Desktop environment with Chrome UI: sign into Browser 1, add Browser 2, sign into a second or same Google account, restart NarrativeX, verify both profile sessions remain available, exercise concurrent work, Reset Login Browser 2, and confirm Browser 1 is unchanged.

## Documentation Impact

The Desktop README and ADR-0021 replace the one-Chrome-host invariant with a default-one, user-expandable browser-pool model. Each browser owns its own persistent Chrome profile while Character/Storyboard lane concurrency remains a global per-user setting.

## Out of Scope

- Storing Google email/password or OAuth refresh tokens in NarrativeX.
- Backend-synchronized browser profiles.
- Syncing login state across devices.
- Automatic creation of Google accounts.
- Browser renaming.
- Per-job manual browser selection.
- Automatically increasing concurrency when a browser is added.
- Silent retry of an already-submitted Gemini prompt on another browser.

## Success Criteria

The implementation is complete at the automated-contract level when a fresh user has one Gemini browser by default, can add additional browser profiles from Settings, each browser owns isolated persistent Chrome login state, per-browser reset/remove operations do not affect siblings, and Character/Storyboard generation automatically uses authenticated browser hosts while honoring existing global per-user concurrency limits.

Real Chrome login persistence and multi-account behavior remain explicitly pending manual runtime verification on a GUI-capable Desktop environment.
