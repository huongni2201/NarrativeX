# Multi Gemini Browser Pool Design

Date: 2026-09-01
Status: approved in chat, pending written-spec review

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
    <narrativex-user-id>/
      browsers/
        <browser-id>/
          chrome-profile/
          session.json
          lanes/
            character/downloads/
            storyboard/downloads/
```

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

Browser registry persistence belongs to the existing per-user Desktop preference/storage boundary, but browser lifecycle and Chrome profile management must live in dedicated modules rather than expanding `desktop-preferences.ts` or `gemini-web-automation.ts` into multi-responsibility files.

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

Opening Settings may use a lightweight probe. Starting generation must revalidate the selected browser before submitting work so stale UI state cannot route a request into a logged-out profile.

## Settings UI

The existing `Gemini Image Generation` settings area becomes two focused subsections.

### Gemini Browsers

Each browser appears as a card/row showing:

- browser display name;
- authentication status;
- `Open` when the browser exists and can be opened;
- `Login` when status is `Not logged in`;
- `Manage login` or equivalent open-profile action when authenticated;
- `Reset login` to remove only that browser's Chrome profile/session after confirmation;
- `Remove` for non-default/additional browser entries.

The section ends with:

```text
+ Add browser
```

Adding a browser creates its registry entry and isolated directories but does not require immediate login.

Removing a browser must refuse while that browser owns active generation leases. Removal deletes that browser's registry entry and local browser automation data only after confirmation. At least one browser entry must always remain.

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

For each requested lane, the pool chooses an authenticated browser that has an available reusable slot for that lane. Scheduling should be fair across ready browsers; round-robin or least-active scheduling is acceptable as long as one browser cannot permanently starve another.

The scheduler must obey both levels of limits:

1. Global user preference limit for the lane.
2. Capacity currently available across authenticated browser hosts.

If only Browser 1 is authenticated, behavior is functionally equivalent to the current one-browser design.

Adding Browser 2 increases available isolation/capacity but does not automatically increase the user's configured Character/Storyboard concurrency values.

A browser that becomes logged out or unavailable is removed from eligible scheduling until it becomes healthy again. In-flight work already submitted to that browser fails only that lease/request; the pool does not silently replay the same generation on another browser because duplicate Gemini submissions could create ambiguous results.

## Browser Host Lifecycle

Introduce a dedicated browser-host abstraction responsible for one browser entry:

```text
GeminiBrowserHost
  - browser id
  - profile directory
  - CDP port/process
  - reusable lane/slot targets
  - authentication probe
  - open/login lifecycle
  - stop/reset lifecycle
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

Existing concrete Gemini page automation should remain focused on one host/session. Large existing files must not absorb browser-registry, settings, pool scheduling, and login-management responsibilities. If a touched file is already doing multiple jobs, the new responsibility is extracted into a focused module instead.

## Persistence Boundaries

Per-user Desktop preference data stores browser registry metadata and existing generation concurrency/window preferences.

Chrome-owned authentication data stays outside the JSON preference payload in each browser's `chrome-profile` directory.

No backend/PostgreSQL migration is required. Browser profiles are device-local and user-local.

Reset behavior:

- `Reset login` for Browser N: stop that host, delete Browser N's `chrome-profile` and automation session, preserve Browser N registry entry.
- `Remove` Browser N: stop host, remove registry entry, and delete that browser's local automation directories.
- Existing `Reset Gemini generation settings`: reset only global Character/Storyboard concurrency overrides; it must not erase browser logins.
- Existing `Reset all personalized settings`: reset Desktop preference metadata but must require explicit confirmation before deleting authenticated Chrome profile data. This implementation should not silently destroy browser login profiles as a side effect of the existing reset button.

## IPC / Preload Contract

Add typed browser-management operations under the existing trusted Desktop bridge, for example:

```ts
preferences/geminiBrowsers.list()
preferences/geminiBrowsers.add()
preferences/geminiBrowsers.open(browserId)
preferences/geminiBrowsers.login(browserId)
preferences/geminiBrowsers.resetLogin(browserId)
preferences/geminiBrowsers.remove(browserId)
```

Exact namespace naming may follow the existing preload convention, but all operations must validate opaque browser IDs and remain sender-bound through the existing trusted IPC policy.

Generation IPC remains browser-agnostic. Renderer code must not receive Chrome profile paths, CDP ports, or raw session cookies.

## Error Handling

- Login window closed before authentication: remain `Not logged in`; do not report success.
- Google requires re-verification: surface `Not logged in` and allow `Login` again.
- Browser start/CDP failure: show `Unavailable` with an actionable retry/open path.
- Removing/resetting an active browser: reject until its generation leases are idle.
- Browser profile directory missing/corrupt: treat as logged out/unavailable and allow reset; do not affect other browser profiles.
- One browser crashes: other browser hosts stay eligible.
- No authenticated browser available for generation: return a clear Gemini-login-required error rather than starting an unowned temporary profile.

## Migration from the Existing Single Browser

The existing per-user/current Gemini browser profile must be adopted as `Browser 1` when possible so users do not lose their current Google login during this migration.

Migration is one-way and local:

1. If the new browser registry is absent, create Browser 1 metadata.
2. Reuse/move the existing single-browser profile/session into Browser 1's expected location using a deterministic migration path.
3. Do not create a second fresh Browser 1 profile when the old authenticated profile exists.
4. Migration must be idempotent across repeated app startups.

If safe adoption cannot be determined, preserve the existing directory and surface Browser 1 as requiring login rather than deleting unknown profile data.

## Testing

Required automated coverage:

1. A new user receives exactly one Browser 1 registry entry.
2. Browser additions receive unique stable IDs and isolated profile paths.
3. At least one browser must remain.
4. Two hosts never share a Chrome profile path or CDP port.
5. Authentication status is derived from a probe, not persisted as authoritative `loggedIn` state.
6. Login opens the intended profile and becomes successful only when the authenticated Gemini UI is detected.
7. Restarting/recreating a host points to the same persistent profile directory.
8. Reset Login affects only the selected browser.
9. Remove is rejected while the selected browser has active leases.
10. Existing single-browser profile migration to Browser 1 is idempotent and preserves profile data.
11. Global Character/Storyboard concurrency does not multiply with browser count.
12. Automatic scheduling distributes work only across authenticated/healthy browser hosts.
13. A failed browser does not invalidate other hosts.
14. Generation IPC stays browser-agnostic and renderer cannot access profile paths/CDP/session data.
15. Existing one-browser workflows and current concurrency tests continue to pass.

Desktop verification should also exercise the real runtime manually: sign into Browser 1, add Browser 2, sign into a second or same Google account, restart NarrativeX, verify both profiles remain authenticated, generate concurrent work, and confirm only the configured global concurrency is used.

## Documentation Impact

Update the Desktop README and the Gemini Web ADR/spec documentation to replace the one-Chrome-host invariant with a default-one, user-expandable browser-pool model. Clarify that each browser has its own persistent Chrome profile while global lane concurrency remains a per-user setting.

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

The feature is complete when a fresh user has one working Gemini browser by default, can add additional browsers from Settings, can sign into each profile independently with persistent Chrome-owned sessions, can reset/remove one browser without affecting others, and Character/Storyboard generation automatically uses the authenticated browser pool while still honoring the existing global per-user concurrency limits.