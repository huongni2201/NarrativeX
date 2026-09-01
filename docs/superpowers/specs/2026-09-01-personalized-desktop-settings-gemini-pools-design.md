# Personalized Desktop Settings and Gemini Pools Design

Date: 2026-09-01
Status: approved

## Goal

Make Desktop preferences local, persistent, and isolated per NarrativeX user while adding configurable Gemini Web parallelism and restoring the main window geometry from the previous session.

## Preference ownership

Electron main owns a versioned `desktop-preferences.json` under `app.getPath("userData")`. Preferences are device-local and keyed by NarrativeX `userId`; they are not synchronized through PostgreSQL. Guest users are valid preference profiles because `/api/v1/auth/me` exposes a stable user id for the current guest identity.

The active profile stores:

- Gemini Character tab count override.
- Gemini Storyboard tab count override.
- Main-window normal bounds and maximized state.

Renderer receives a narrow preload API for binding the current user, reading effective preferences, updating Gemini settings, and resetting the current profile.

## Defaults and precedence

Built-in defaults are Character `2`, Storyboard `4`, range `1..8`.

Environment defaults use:

- `NARRATIVEX_GEMINI_CHARACTER_TAB_COUNT`
- `NARRATIVEX_GEMINI_STORYBOARD_TAB_COUNT`

Effective value precedence is user override -> valid environment default -> built-in default. Resetting Gemini settings removes only the user override so environment defaults become effective again.

## Window persistence

Electron records `BrowserWindow.getNormalBounds()` plus `isMaximized()` on move/resize/maximize/unmaximize/close using a debounced write. Startup loads the last active user's saved window state before creating the BrowserWindow. Saved bounds are clamped to a currently connected display; invalid/off-screen state falls back to the current display work area. If the previous window was maximized, the restored window is maximized after construction.

Reset window layout clears saved geometry for the current user and applies the default layout immediately.

## User switching

After `/api/v1/auth/me` resolves, `AuthGuard` binds that `user.id` through the preload preferences bridge. Binding switches the active local profile and returns its effective settings. Signed-in and guest identities remain isolated. Reset operations affect only the active profile.

## Gemini Web pool

One shared Chrome process/profile remains authoritative. Each logical lane owns N independent slots. A slot owns its target id, busy flag, CDP connection lifetime, network capture, and download directory. Character and Storyboard use their effective configured counts when a new queue/run begins.

Changing the preference while work is running is persisted immediately but does not resize an active queue; the next generation batch uses the new count.

## Renderer queues

Generate-all runners execute up to the lane concurrency in parallel and keep multiple active item ids. Completion, skip, failure, persistence, and progress remain item-specific. A failure must not cause successful sibling items to be regenerated.

## Settings UI

`SettingsScreen` adds a Personalization section with Character and Storyboard parallel tab controls, displayed environment defaults, and reset actions:

- Reset Gemini generation settings.
- Reset window layout.
- Reset all personalized settings.

All controls operate on the current user profile without requiring code edits or rebuilds.

## Testing

Automated tests cover env parsing/fallback, per-user isolation, reset semantics, corrupted preference files, window-bound clamping, preload bridge contract, settings UI wiring, Gemini lane slot configuration, and queue parallel-state transitions. Desktop check/type-check/build must remain green.
