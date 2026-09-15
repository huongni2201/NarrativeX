# Desktop/browser verification

Apply when writing Playwright tests or automating a Desktop UI flow. Use the automation APIs available in the environment.

1. Start or reuse the development environment. Prefer accessible role/label locators; use stable test IDs when semantics cannot identify the target.
2. Synchronize on observable state: locator auto-waiting, retrying assertions, navigation or a specific response. Register event/response waits before the triggering action to avoid races.
3. Avoid fixed sleeps for rendering/network completion. Choose bounded timeouts appropriate to the operation; compute tasks need a different budget from button interactions.
4. Assert the user-visible outcome and inspect failed requests, console errors, loading/error/empty states and layout. Capture screenshots when supported.
5. Keep deterministic mocks inside isolated tests. Running-application verification must exercise real API integration; fixture success is not production-health evidence.
6. Keep automated runs free of artificial slow motion; use it only for interactive debugging.

Browser checks cover renderer behavior. Filesystem, preload, deep-link and FFmpeg changes also need Electron/native flow evidence. Report missing native coverage or unavailable automation following `AGENTS.md`.
