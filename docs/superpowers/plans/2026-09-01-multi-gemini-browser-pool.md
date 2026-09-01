# Multi Gemini Browser Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, per-user Gemini browser registry to NarrativeX Desktop so every user has one browser by default, can add independently authenticated browser profiles from Settings, and can automatically route Gemini generation across authenticated browsers without multiplying Character/Storyboard concurrency.

**Architecture:** Keep renderer generation calls browser-agnostic. Split Chrome/CDP lifecycle out of the oversized page-automation file, make one `GeminiBrowserHost` own one persistent Chrome profile plus its reusable page-slot pool, and put a higher-level `GeminiBrowserPool` in Electron main to select authenticated hosts under a global per-lane capacity gate. Persist only browser metadata in Desktop preferences; Chrome-owned cookies/session data remain inside isolated per-user browser profile directories.

**Tech Stack:** Electron 44, TypeScript 7, React 19, Node `node:test`, Chrome DevTools Protocol, existing trusted IPC/preload bridge, local JSON Desktop preferences.

**Spec:** `docs/superpowers/specs/2026-09-01-multi-gemini-browser-pool-design.md`

## Global Constraints

- A fresh NarrativeX user has exactly one browser entry: `Browser 1`.
- Additional browsers use independent Chrome processes, `--user-data-dir` directories, CDP ports, target registries, and download namespaces.
- NarrativeX never stores Google passwords, cookies, OAuth tokens, or raw Chrome session data in Desktop preferences or renderer state.
- Authentication status is derived from the live Gemini page and is one of `CHECKING`, `LOGGED_IN`, `NOT_LOGGED_IN`, or `UNAVAILABLE`.
- Existing Character and Storyboard tab counts remain global per-user concurrency limits in the range 1-8; browser count never multiplies those limits.
- Generation callers never choose a browser and never receive profile paths, CDP ports, or cookies.
- An already-submitted generation is never silently retried on a second browser.
- At least one browser registry entry must always remain.
- Removing or resetting a browser with active generation leases must fail closed.
- Existing single-browser Chrome profile/session data must be adopted by Browser 1 idempotently when safe; unknown legacy data must never be deleted.
- Browser registry/profile state is device-local and user-local; no backend or PostgreSQL migration is introduced.
- Existing `Reset Gemini generation settings` and `Reset all personalized settings` must not silently delete Chrome login profiles.
- When touching a large file, extract the new responsibility into a focused module instead of expanding the large file further.

---

## File Structure

### New focused modules

- `app/desktop/src/main/gemini-web/gemini-browser-registry.ts` — browser metadata defaults, validation, stable per-user directory key, add/remove rules.
- `app/desktop/src/main/gemini-web/gemini-web-cdp.ts` — reusable CDP client and evaluate helpers extracted from `gemini-web-automation.ts`.
- `app/desktop/src/main/gemini-web/gemini-chrome-session.ts` — one Chrome process/profile, CDP port, target registry, foreground/open/login/auth probe, stop lifecycle.
- `app/desktop/src/main/gemini-web/gemini-browser-storage.ts` — browser root paths, legacy single-browser migration, reset-login and remove-data filesystem operations.
- `app/desktop/src/main/gemini-web/gemini-browser-host.ts` — one browser entry + one host-local `GeminiWebAutomationPool`, authentication health and active-lease accounting.
- `app/desktop/src/main/gemini-web/gemini-browser-pool.ts` — active-user host collection, global lane gates, authenticated-host selection, add/remove/login/open operations.
- `app/desktop/src/main/gemini-web/gemini-browser-ipc.ts` — trusted IPC handlers for Settings browser management.
- `app/desktop/src/renderer/features/settings/components/GeminiBrowserSettings.tsx` — browser cards, auth status/actions and Add Browser.
- `app/desktop/src/renderer/features/settings/components/GeminiConcurrencySettings.tsx` — existing Character/Storyboard concurrency controls moved out of `SettingsScreen.tsx`.

### Modified existing modules

- `app/desktop/src/main/preferences/desktop-preferences.ts` — schema migration and browser-registry metadata only; no Chrome lifecycle/filesystem logic.
- `app/desktop/src/main/gemini-web/gemini-web-automation.ts` — remove CDP and Chrome-process ownership; retain Gemini page-generation behavior only.
- `app/desktop/src/main/gemini-web/gemini-web-automation-pool.ts` — become a host-local reusable-tab pool sharing one `GeminiChromeSession`; remove shared-port session-file seeding.
- `app/desktop/src/main/gemini-web/gemini-web-ipc.ts` — route generation through `GeminiBrowserPool`; keep image staging/commit concerns.
- `app/desktop/src/preload/types.ts`, `app/desktop/src/preload/index.ts` — typed browser management bridge.
- `app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx` — compose focused browser/concurrency sections instead of owning browser behavior.
- `app/desktop/README.md`, `documentation/decisions/ADR-0021-desktop-gemini-web-image-generation.md` — document default-one expandable browser pool.

### Tests

- Create `app/desktop/test/gemini-browser-registry.test.mjs`.
- Create `app/desktop/test/gemini-chrome-session.test.mjs` for pure/session-contract seams with injected process/CDP dependencies; real Chrome remains runtime verification.
- Create `app/desktop/test/gemini-browser-storage.test.mjs`.
- Create `app/desktop/test/gemini-browser-pool.test.mjs`.
- Create `app/desktop/test/gemini-browser-ipc-contract.test.mjs`.
- Modify `app/desktop/test/desktop-preferences.test.mjs`.
- Modify `app/desktop/test/gemini-web-automation-pool.test.mjs`.
- Modify `app/desktop/test/personalized-settings-contract.test.mjs`.

---

### Task 1: Add a versioned per-user browser registry to Desktop preferences

**Files:**
- Create: `app/desktop/src/main/gemini-web/gemini-browser-registry.ts`
- Modify: `app/desktop/src/main/preferences/desktop-preferences.ts`
- Modify: `app/desktop/src/preload/types.ts`
- Test: `app/desktop/test/gemini-browser-registry.test.mjs`
- Test: `app/desktop/test/desktop-preferences.test.mjs`

**Interfaces:**
- Produces:
  ```ts
  export const DEFAULT_GEMINI_BROWSER_ID = "browser-1";
  export interface GeminiBrowserProfile {
    id: string;
    name: string;
    createdAt: string;
  }
  export function defaultGeminiBrowserProfile(now?: Date): GeminiBrowserProfile;
  export function sanitizeGeminiBrowserProfiles(value: unknown): GeminiBrowserProfile[];
  export function addGeminiBrowserProfile(current: readonly GeminiBrowserProfile[], now?: Date): GeminiBrowserProfile[];
  export function removeGeminiBrowserProfile(current: readonly GeminiBrowserProfile[], browserId: string): GeminiBrowserProfile[];
  export function geminiBrowserUserKey(userId: string): string;
  ```
- `EffectiveDesktopPreferences.gemini.browsers` returns the browser registry; auth state is deliberately absent.
- `DesktopPreferencesStore.addGeminiBrowser()` and `DesktopPreferencesStore.removeGeminiBrowser(browserId)` mutate metadata only.

- [ ] **Step 1: Write failing browser-registry tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GEMINI_BROWSER_ID,
  addGeminiBrowserProfile,
  defaultGeminiBrowserProfile,
  geminiBrowserUserKey,
  removeGeminiBrowserProfile,
} from "../src/main/gemini-web/gemini-browser-registry.ts";

test("a fresh Gemini registry contains Browser 1", () => {
  assert.deepEqual(defaultGeminiBrowserProfile(new Date("2026-09-01T00:00:00.000Z")), {
    id: DEFAULT_GEMINI_BROWSER_ID,
    name: "Browser 1",
    createdAt: "2026-09-01T00:00:00.000Z",
  });
});

test("adding a browser creates a unique opaque id and sequential display name", () => {
  const first = [defaultGeminiBrowserProfile(new Date("2026-09-01T00:00:00.000Z"))];
  const next = addGeminiBrowserProfile(first, new Date("2026-09-01T00:01:00.000Z"));
  assert.equal(next.length, 2);
  assert.equal(next[1].name, "Browser 2");
  assert.notEqual(next[1].id, first[0].id);
  assert.match(next[1].id, /^browser-[A-Za-z0-9-]+$/);
});

test("the final browser cannot be removed", () => {
  const first = [defaultGeminiBrowserProfile()];
  assert.throws(() => removeGeminiBrowserProfile(first, DEFAULT_GEMINI_BROWSER_ID), /at least one/i);
});

test("user directory keys never expose raw user ids", () => {
  const key = geminiBrowserUserKey("../../user@example.com");
  assert.match(key, /^[a-f0-9]{32}$/);
  assert.equal(key.includes(".."), false);
  assert.equal(key.includes("@"), false);
});
```

- [ ] **Step 2: Run the registry tests and verify RED**

Run:
```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-registry.test.mjs
```
Expected: FAIL because `gemini-browser-registry.ts` does not exist.

- [ ] **Step 3: Implement the pure registry model**

Use `randomUUID()` only for added browsers and SHA-256 for filesystem-safe user keys:

```ts
import { createHash, randomUUID } from "node:crypto";

export const DEFAULT_GEMINI_BROWSER_ID = "browser-1";

export interface GeminiBrowserProfile {
  id: string;
  name: string;
  createdAt: string;
}

export function defaultGeminiBrowserProfile(now = new Date()): GeminiBrowserProfile {
  return { id: DEFAULT_GEMINI_BROWSER_ID, name: "Browser 1", createdAt: now.toISOString() };
}

export function addGeminiBrowserProfile(
  current: readonly GeminiBrowserProfile[],
  now = new Date(),
): GeminiBrowserProfile[] {
  const nextIndex = current.reduce((max, entry) => {
    const match = /^Browser (\d+)$/.exec(entry.name);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0) + 1;
  return [
    ...current,
    { id: `browser-${randomUUID()}`, name: `Browser ${nextIndex}`, createdAt: now.toISOString() },
  ];
}

export function removeGeminiBrowserProfile(
  current: readonly GeminiBrowserProfile[],
  browserId: string,
): GeminiBrowserProfile[] {
  if (current.length <= 1) throw new Error("At least one Gemini browser must remain.");
  if (!current.some((entry) => entry.id === browserId)) throw new Error("Gemini browser was not found.");
  return current.filter((entry) => entry.id !== browserId);
}

export function geminiBrowserUserKey(userId: string): string {
  return createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 32);
}
```

Add strict sanitization for persisted `id`, `name`, `createdAt`; fall back to Browser 1 when the array is absent or empty.

- [ ] **Step 4: Migrate `desktop-preferences.ts` from schema v1 to schema v2 without losing v1 data**

The stored profile becomes:

```ts
type StoredProfile = {
  gemini?: Partial<GeminiTabCounts> & { browsers?: GeminiBrowserProfile[] };
  window?: SavedWindowState;
};

type StoredPreferences = {
  schemaVersion: 2;
  lastActiveUserId: string | null;
  profiles: Record<string, StoredProfile>;
};
```

`sanitizePreferences()` must accept both schema versions. For v1, preserve `gemini.characterTabs`, `gemini.storyboardTabs`, window state and user ids, then initialize `browsers` with Browser 1. `reset("GEMINI")` resets only tab-count overrides and preserves `browsers`; `reset("ALL")` resets tab-count/window personalization but preserves browser registry metadata so existing login profiles are not orphaned.

- [ ] **Step 5: Extend bridge types**

Add:

```ts
export interface DesktopGeminiBrowserProfile {
  id: string;
  name: string;
  createdAt: string;
}

export interface DesktopGeminiPreferences {
  characterTabs: number;
  storyboardTabs: number;
  browsers: DesktopGeminiBrowserProfile[];
  environmentDefaults: {
    characterTabs: number;
    storyboardTabs: number;
  };
}
```

Do not put `loggedIn`, profile paths or ports in `DesktopPreferences`.

- [ ] **Step 6: Add preference migration/reset tests and run GREEN**

Add assertions that a v1 JSON file loads with existing tab counts plus Browser 1, adding Browser 2 survives a restart, and both `GEMINI` and `ALL` reset preserve browser metadata.

Run:
```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-registry.test.mjs test/desktop-preferences.test.mjs
```
Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add app/desktop/src/main/gemini-web/gemini-browser-registry.ts app/desktop/src/main/preferences/desktop-preferences.ts app/desktop/src/preload/types.ts app/desktop/test/gemini-browser-registry.test.mjs app/desktop/test/desktop-preferences.test.mjs
git commit -m "feat: add per-user Gemini browser registry"
```

---

### Task 2: Split CDP and Chrome-session ownership out of the large automation file

**Files:**
- Create: `app/desktop/src/main/gemini-web/gemini-web-cdp.ts`
- Create: `app/desktop/src/main/gemini-web/gemini-chrome-session.ts`
- Modify: `app/desktop/src/main/gemini-web/gemini-web-automation.ts`
- Test: `app/desktop/test/gemini-chrome-session.test.mjs`
- Test: `app/desktop/test/desktop-main-boundaries.test.mjs`

**Interfaces:**
- Produces:
  ```ts
  export type GeminiBrowserAuthStatus = "LOGGED_IN" | "NOT_LOGGED_IN" | "UNAVAILABLE";

  export interface GeminiChromeTarget {
    id: string;
    webSocketDebuggerUrl: string;
  }

  export class GeminiChromeSession {
    constructor(rootDirectory: string);
    ensureTarget(targetKey: string): Promise<GeminiChromeTarget>;
    probeAuthentication(targetKey?: string): Promise<GeminiBrowserAuthStatus>;
    openForLogin(targetKey?: string): Promise<GeminiBrowserAuthStatus>;
    stop(): Promise<void>;
    sessionFilePath(): string;
    profilePath(): string;
  }
  ```
- `GeminiWebAutomation` consumes one `GeminiChromeSession`, a unique `targetKey`, and a lane-specific download directory; it no longer owns a Chrome process or profile directory.

- [ ] **Step 1: Write failing session-contract tests**

Test pure seams rather than launching real Chrome in unit tests. Export and test auth-state classification:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { classifyGeminiAuthSnapshot } from "../src/main/gemini-web/gemini-chrome-session.ts";

test("Gemini composer means logged in", () => {
  assert.equal(classifyGeminiAuthSnapshot({ composer: true, signIn: false }), "LOGGED_IN");
});

test("Gemini sign-in UI means not logged in", () => {
  assert.equal(classifyGeminiAuthSnapshot({ composer: false, signIn: true }), "NOT_LOGGED_IN");
});

test("an indeterminate reachable page is unavailable rather than falsely authenticated", () => {
  assert.equal(classifyGeminiAuthSnapshot({ composer: false, signIn: false }), "UNAVAILABLE");
});
```

Also add a static boundary test asserting `gemini-web-automation.ts` no longer imports `node:child_process` or `node:net` after the split.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-chrome-session.test.mjs test/desktop-main-boundaries.test.mjs
```
Expected: FAIL because the session module does not exist and automation still owns Chrome process startup.

- [ ] **Step 3: Extract the CDP transport unchanged**

Move `CdpClient`, the CDP envelope types and the generic `evaluate<T>()` helper from `gemini-web-automation.ts` into `gemini-web-cdp.ts`:

```ts
export class CdpClient {
  static connect(url: string): Promise<CdpClient>;
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  on<T>(method: string, listener: (params: T) => void): () => void;
  close(): void;
}

export async function evaluate<T>(cdp: CdpClient, expression: string): Promise<T>;
```

Preserve the existing pending-request rejection behavior on socket close.

- [ ] **Step 4: Move Chrome process/session/target lifecycle into `GeminiChromeSession`**

Persist arbitrary target keys rather than `GeminiWebLane` keys:

```ts
type PersistedChromeSession = {
  port: number;
  targets?: Record<string, string>;
};
```

`ensureTarget("character:0")`, `ensureTarget("storyboard:3")`, and `ensureTarget("control")` must each reuse only their own target id. Starting Chrome keeps one unique `--remote-debugging-port` and one unique `--user-data-dir` for that browser root.

Do not launch a bootstrap `--new-window about:blank`. Launch the browser host with the debugging/profile flags only; create Gemini pages explicitly through `/json/new?https%3A%2F%2Fgemini.google.com%2Fapp`.

- [ ] **Step 5: Implement non-blocking auth probe and explicit login flow**

Use one shared DOM snapshot expression:

```ts
export function classifyGeminiAuthSnapshot(snapshot: {
  composer: boolean;
  signIn: boolean;
}): GeminiBrowserAuthStatus {
  if (snapshot.composer) return "LOGGED_IN";
  if (snapshot.signIn) return "NOT_LOGGED_IN";
  return "UNAVAILABLE";
}
```

`probeAuthentication()` starts/reuses the host, opens/reuses `control`, navigates it to Gemini, evaluates once after the page-ready grace period, and returns without a 10-minute wait.

`openForLogin()` brings `control` to the foreground, restores its Chrome window using browser CDP (`Browser.getWindowForTarget` + `Browser.setWindowBounds({ bounds: { windowState: "normal" } })`), then polls up to the existing 10-minute login timeout and returns `LOGGED_IN` only when the composer is detected. Closing the window or timeout returns/throws an auth-required result; it never writes credentials.

- [ ] **Step 6: Refactor `GeminiWebAutomation` to consume the shared session**

Constructor becomes:

```ts
constructor(
  private readonly session: GeminiChromeSession,
  private readonly targetKey: string,
  private readonly downloadDirectory: string,
) {}
```

Generation obtains the target with `session.ensureTarget(targetKey)`, then retains the existing page-mode, reference upload, network capture and download behavior. Remove its `chromeProcess`, `profileDirectory`, `sessionFile`, `port`, `chromeStartPromise`, `startChrome()`, `ensureChrome()`, `stop()` and target-persistence responsibilities.

- [ ] **Step 7: Run session/boundary tests GREEN**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-chrome-session.test.mjs test/desktop-main-boundaries.test.mjs
npm run type-check
```
Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add app/desktop/src/main/gemini-web/gemini-web-cdp.ts app/desktop/src/main/gemini-web/gemini-chrome-session.ts app/desktop/src/main/gemini-web/gemini-web-automation.ts app/desktop/test/gemini-chrome-session.test.mjs app/desktop/test/desktop-main-boundaries.test.mjs
git commit -m "refactor: split Gemini Chrome session lifecycle"
```

---

### Task 3: Make the existing automation pool a single-browser reusable-tab pool

**Files:**
- Modify: `app/desktop/src/main/gemini-web/gemini-web-automation-pool.ts`
- Modify: `app/desktop/test/gemini-web-automation-pool.test.mjs`

**Interfaces:**
- Consumes: `GeminiChromeSession`, refactored `GeminiWebAutomation`.
- Produces:
  ```ts
  export class GeminiWebAutomationPool {
    constructor(
      rootDirectory: string,
      getTabCounts: () => Promise<TabCounts>,
      createAutomation?: GeminiPoolAutomationFactory,
    );
    generateImage(...): Promise<GeminiPoolGenerationResult>;
    authStatus(): Promise<GeminiBrowserAuthStatus>;
    openForLogin(): Promise<GeminiBrowserAuthStatus>;
    stop(): Promise<void>;
  }
  ```

- [ ] **Step 1: Rewrite pool tests to require one shared session rather than copied `session.json` ports**

Replace the old secondary-session assertion with a target-key assertion:

```js
test("parallel slots in one browser share one Chrome host and use distinct target keys", async () => {
  const targetKeys = [];
  const pool = new GeminiWebAutomationPool(
    root,
    async () => ({ characterTabs: 2, storyboardTabs: 4 }),
    (_session, targetKey, slotRoot) => {
      targetKeys.push(targetKey);
      return fakeAutomation(slotRoot);
    },
  );
  await Promise.all([
    pool.generateImage("CHARACTER", "a"),
    pool.generateImage("CHARACTER", "b"),
  ]);
  assert.deepEqual(new Set(targetKeys), new Set(["character:0", "character:1"]));
});
```

Add delegation tests for `authStatus()` and `openForLogin()` to the pool's one shared `GeminiChromeSession`.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-web-automation-pool.test.mjs
```
Expected: FAIL against the existing shared-port seeding architecture.

- [ ] **Step 3: Remove secondary session-file seeding**

Delete `mergeSharedPortSession`, `seedSecondarySession`, `primarySessionFile` and all `readFile/writeFile` shared-port polling from `gemini-web-automation-pool.ts`.

Create exactly one `GeminiChromeSession(rootDirectory)` per pool, and create slot automation with stable keys:

```ts
const targetKey = `${lane.toLowerCase()}:${index}`;
const slotRoot = join(this.rootDirectory, "slots", lane.toLowerCase(), String(index));
return {
  rootDirectory: slotRoot,
  automation: this.createAutomation(this.session, targetKey, slotRoot),
};
```

`stop()` calls `session.stop()` once after lane pools are cleared; individual page automation instances do not close the browser host.

- [ ] **Step 4: Expose host-level login/auth control**

```ts
async authStatus(): Promise<GeminiBrowserAuthStatus> {
  return this.session.probeAuthentication("control");
}

async openForLogin(): Promise<GeminiBrowserAuthStatus> {
  return this.session.openForLogin("control");
}
```

- [ ] **Step 5: Run GREEN**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-web-automation-pool.test.mjs
npm run type-check
```
Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add app/desktop/src/main/gemini-web/gemini-web-automation-pool.ts app/desktop/test/gemini-web-automation-pool.test.mjs
git commit -m "refactor: share one Chrome session per Gemini browser"
```

---

### Task 4: Add isolated browser storage and safe legacy Browser 1 migration

**Files:**
- Create: `app/desktop/src/main/gemini-web/gemini-browser-storage.ts`
- Test: `app/desktop/test/gemini-browser-storage.test.mjs`

**Interfaces:**
- Consumes: `geminiBrowserUserKey()` and browser ids.
- Produces:
  ```ts
  export class GeminiBrowserStorage {
    constructor(private readonly legacyRoot: string);
    userRoot(userId: string): string;
    browserRoot(userId: string, browserId: string): string;
    migrateLegacyBrowserOne(userId: string): Promise<void>;
    resetLogin(userId: string, browserId: string): Promise<void>;
    removeBrowserData(userId: string, browserId: string): Promise<void>;
  }
  ```

- [ ] **Step 1: Write failing filesystem tests**

Use `mkdtemp()` and create legacy `chrome-profile/Default/Cookies`, `session.json`, `lanes/`, and `slots/` files. Assert:

```js
await storage.migrateLegacyBrowserOne("user-a");
assert.equal(await readFile(join(storage.browserRoot("user-a", "browser-1"), "chrome-profile", "Default", "Cookies"), "utf8"), "cookie-data");
await storage.migrateLegacyBrowserOne("user-a");
assert.equal(await readFile(...), "cookie-data");
```

Also assert reset-login removes only `chrome-profile` + `session.json` for the selected browser, while `removeBrowserData` removes the selected browser root and leaves siblings untouched.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-storage.test.mjs
```
Expected: FAIL because storage module does not exist.

- [ ] **Step 3: Implement deterministic paths and idempotent migration**

New paths:

```ts
userRoot(userId) = join(legacyRoot, "users", geminiBrowserUserKey(userId));
browserRoot(userId, browserId) = join(userRoot(userId), "browsers", browserId);
```

Only migrate known legacy entries: `chrome-profile`, `session.json`, `lanes`, `slots`. Never move/delete the new `users` directory or unknown files. For each known entry, if the target already exists, leave source and target untouched rather than overwriting. If all target entries are absent, `rename()` the known entries into Browser 1. Repeated calls become no-ops.

- [ ] **Step 4: Implement reset/remove safety at the filesystem layer**

`resetLogin()` deletes only selected browser `chrome-profile` and `session.json`; it may also remove stale slot/lane runtime directories after the host has been stopped. `removeBrowserData()` recursively removes only `browserRoot(userId, browserId)`.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-storage.test.mjs
git add app/desktop/src/main/gemini-web/gemini-browser-storage.ts app/desktop/test/gemini-browser-storage.test.mjs
git commit -m "feat: isolate Gemini browser profile storage"
```

---

### Task 5: Add browser hosts and a global authenticated browser scheduler

**Files:**
- Create: `app/desktop/src/main/gemini-web/gemini-browser-host.ts`
- Create: `app/desktop/src/main/gemini-web/gemini-browser-pool.ts`
- Test: `app/desktop/test/gemini-browser-pool.test.mjs`

**Interfaces:**
- Consumes: browser registry, `GeminiBrowserStorage`, host-local `GeminiWebAutomationPool`, `DesktopPreferencesStore`.
- Produces:
  ```ts
  export interface GeminiBrowserView {
    id: string;
    name: string;
    createdAt: string;
    authStatus: "CHECKING" | "LOGGED_IN" | "NOT_LOGGED_IN" | "UNAVAILABLE";
    activeLeases: number;
    canRemove: boolean;
  }

  export class GeminiBrowserHost {
    readonly browserId: string;
    authStatus(): Promise<Exclude<GeminiBrowserView["authStatus"], "CHECKING">>;
    open(): Promise<void>;
    login(): Promise<void>;
    generateImage(...): Promise<GeminiPoolGenerationResult>;
    activeLeaseCount(): number;
    stop(): Promise<void>;
  }

  export class GeminiBrowserPool {
    list(): Promise<GeminiBrowserView[]>;
    add(): Promise<GeminiBrowserView[]>;
    open(browserId: string): Promise<void>;
    login(browserId: string): Promise<GeminiBrowserView[]>;
    resetLogin(browserId: string): Promise<GeminiBrowserView[]>;
    remove(browserId: string): Promise<GeminiBrowserView[]>;
    generateImage(...): Promise<GeminiPoolGenerationResult>;
    stop(): Promise<void>;
  }
  ```

- [ ] **Step 1: Write failing scheduler tests with fake hosts**

Cover four invariants:

```js
test("two browsers do not multiply Character concurrency", async () => {
  // preferences.characterTabs = 2; both fake hosts LOGGED_IN.
  // Submit 4 requests and hold each fake generation behind a gate.
  // Assert max total active across both hosts is exactly 2.
});

test("scheduler ignores logged-out and unavailable browsers", async () => {
  // host A NOT_LOGGED_IN, host B LOGGED_IN -> only B receives generation.
});

test("least-active selection distributes work across authenticated hosts", async () => {
  // With equal initial load, two simultaneous leases land on different hosts.
});

test("generation failure is not replayed on another browser", async () => {
  // Host A throws after submission; assert Host B generateImage call count remains 0 for that request.
});
```

Add management tests: final browser removal rejected; remove/reset rejected while target host `activeLeaseCount() > 0`; login changes view only after fake host reports `LOGGED_IN`.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-pool.test.mjs
```
Expected: FAIL because host/pool modules do not exist.

- [ ] **Step 3: Implement `GeminiBrowserHost`**

One host owns exactly one host-local automation pool rooted at `GeminiBrowserStorage.browserRoot(userId, browserId)`. It increments its `activeLeases` around generation in `try/finally` and delegates `authStatus()` / `login()` to the host-local automation pool.

`open()` must only bring/open the selected browser's `control` target; it must not alter another browser host.

- [ ] **Step 4: Implement active-user isolation in `GeminiBrowserPool`**

Before every public operation:

```ts
const preferences = await this.preferences.get();
const userId = preferences.userId;
await this.switchActiveUserIfNeeded(userId);
```

When the active NarrativeX user changes, stop and discard all previous-user hosts before resolving the new user's browser roots. This prevents Browser 1 from user A being reused by user B.

On first use for a user, call `storage.migrateLegacyBrowserOne(userId)` before creating Browser 1.

- [ ] **Step 5: Add one global capacity gate per lane**

Use existing `GeminiWebSlotPool` as the global semaphore. For a lane, create/recreate a gate only when its configured capacity changes and no global leases are active, preserving the existing in-flight snapshot behavior.

Pseudo-implementation:

```ts
const counts = await this.preferences.get();
const capacity = lane === "CHARACTER"
  ? counts.gemini.characterTabs
  : counts.gemini.storyboardTabs;
const globalLease = await this.globalLaneGate(lane, capacity).acquire();
try {
  const host = await this.selectAuthenticatedHost();
  return await host.generateImage(lane, prompt, references);
} finally {
  globalLease.release();
}
```

The host-local pool may support up to the same configured capacity, but only the top-level gate defines total concurrency across all browsers.

- [ ] **Step 6: Implement fair authenticated host selection**

Probe hosts before selection. Eligible = `LOGGED_IN`. Sort by `activeLeaseCount()` then rotate ties using a per-lane round-robin cursor. If none are authenticated, throw a stable actionable error such as:

```ts
throw new Error("No signed-in Gemini browser is available. Open Desktop Settings and sign in to at least one Gemini browser.");
```

Select exactly one host per request. Do not catch a generation error and try another host.

- [ ] **Step 7: Implement add/login/reset/remove orchestration**

- `add()` mutates preference metadata and creates no Chrome process until opened/logged in/generated.
- `login(id)` calls only that host and returns refreshed list.
- `resetLogin(id)` refuses active leases, stops host, calls storage reset, discards host instance, and returns `NOT_LOGGED_IN` on next probe.
- `remove(id)` refuses active leases and final-browser removal, stops host, removes metadata, then removes only that browser root.

- [ ] **Step 8: Run GREEN**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-pool.test.mjs
npm run type-check
```
Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add app/desktop/src/main/gemini-web/gemini-browser-host.ts app/desktop/src/main/gemini-web/gemini-browser-pool.ts app/desktop/test/gemini-browser-pool.test.mjs
git commit -m "feat: schedule Gemini work across browser profiles"
```

---

### Task 6: Wire trusted IPC/preload browser management and route generation through the new pool

**Files:**
- Create: `app/desktop/src/main/gemini-web/gemini-browser-ipc.ts`
- Modify: `app/desktop/src/main/gemini-web/gemini-web-ipc.ts`
- Modify: `app/desktop/src/preload/types.ts`
- Modify: `app/desktop/src/preload/index.ts`
- Test: `app/desktop/test/gemini-browser-ipc-contract.test.mjs`
- Test: `app/desktop/test/runtime-hardening.test.mjs`

**Interfaces:**
- Produces renderer-safe operations:
  ```ts
  geminiWeb: {
    browsers: {
      list(): Promise<GeminiBrowserView[]>;
      add(): Promise<GeminiBrowserView[]>;
      open(browserId: string): Promise<void>;
      login(browserId: string): Promise<GeminiBrowserView[]>;
      resetLogin(browserId: string): Promise<GeminiBrowserView[]>;
      remove(browserId: string): Promise<GeminiBrowserView[]>;
    };
    generateImage(...): Promise<LocalAssetSelection>;
    commitImage(...): Promise<LocalAssetImportResult>;
  }
  ```

- [ ] **Step 1: Write failing IPC/preload contract tests**

Assert preload exposes exactly the six browser operations, all mutations cross trusted IPC, and no browser view contains `profilePath`, `sessionFile`, `port`, `cookie`, or `token`.

Add ID-validation cases using the same opaque pattern used by current Gemini image IPC:

```js
for (const badId of ["", "../browser", "browser/2", " ".repeat(2)]) {
  // invoke handler -> rejects Invalid Gemini browser id
}
```

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-ipc-contract.test.mjs test/runtime-hardening.test.mjs
```
Expected: FAIL because browser management bridge is absent.

- [ ] **Step 3: Create `gemini-browser-ipc.ts`**

Register:

```text
desktop:gemini-web:browsers:list
desktop:gemini-web:browsers:add
desktop:gemini-web:browsers:open
desktop:gemini-web:browsers:login
desktop:gemini-web:browsers:reset-login
desktop:gemini-web:browsers:remove
```

Use `registerTrustedIpcHandler` for every operation. Validate browser IDs against `/^[A-Za-z0-9._-]{1,128}$/` before passing them to the manager.

- [ ] **Step 4: Replace `GeminiWebAutomationPool` construction in `gemini-web-ipc.ts` with one `GeminiBrowserPool`**

Current image staging/reference/commit logic remains unchanged. Only this line of ownership changes conceptually:

```ts
const browsers = new GeminiBrowserPool(
  automationRoot,
  desktopPreferencesStore(),
  (browserRoot, getCounts) => new GeminiBrowserHost(browserRoot, getCounts),
);
```

Generation becomes:

```ts
const result = await browsers.generateImage(input.lane, input.prompt, references);
```

`before-quit` stops the top-level browser pool once.

- [ ] **Step 5: Extend preload types and `contextBridge` implementation**

Expose only browser id/name/date/auth status/active leases/canRemove. Keep profile roots/CDP details in Electron main.

- [ ] **Step 6: Run GREEN**

```bash
node --experimental-strip-types --experimental-transform-types --test test/gemini-browser-ipc-contract.test.mjs test/runtime-hardening.test.mjs
npm run type-check
```
Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add app/desktop/src/main/gemini-web/gemini-browser-ipc.ts app/desktop/src/main/gemini-web/gemini-web-ipc.ts app/desktop/src/preload/types.ts app/desktop/src/preload/index.ts app/desktop/test/gemini-browser-ipc-contract.test.mjs app/desktop/test/runtime-hardening.test.mjs
git commit -m "feat: expose Gemini browser management to settings"
```

---

### Task 7: Add browser cards, Login, Add Browser and safe reset/remove actions to Settings

**Files:**
- Create: `app/desktop/src/renderer/features/settings/components/GeminiBrowserSettings.tsx`
- Create: `app/desktop/src/renderer/features/settings/components/GeminiConcurrencySettings.tsx`
- Modify: `app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx`
- Modify: `app/desktop/test/personalized-settings-contract.test.mjs`

**Interfaces:**
- Consumes: `window.narrativex.geminiWeb.browsers.*`, existing `window.narrativex.preferences.updateGemini/reset`.
- `SettingsScreen` owns top-level notices/loading only; browser/concurrency UI is moved into focused components.

- [ ] **Step 1: Write failing Settings contract assertions**

Assert source contains:

```text
Gemini Browsers
Add browser
Login
Reset login
Remove
Generation Concurrency
```

Also assert the browser component calls `geminiWeb.browsers.list/add/login/open/resetLogin/remove`, while `SettingsScreen.tsx` no longer contains all browser-action implementations inline.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --experimental-transform-types --test test/personalized-settings-contract.test.mjs
```
Expected: FAIL because the browser Settings section does not exist.

- [ ] **Step 3: Extract existing tab controls into `GeminiConcurrencySettings.tsx`**

Keep the current 1-8 +/- behavior and environment-default helper text exactly functional. The component receives `preferences`, `onUpdate`, and `onReset` rather than reading IPC directly.

- [ ] **Step 4: Implement `GeminiBrowserSettings.tsx`**

On mount and after every action, refresh `list()`.

Render each browser with status copy:

```ts
const STATUS_COPY = {
  CHECKING: "Checking…",
  LOGGED_IN: "Logged in",
  NOT_LOGGED_IN: "Not logged in",
  UNAVAILABLE: "Unavailable",
} as const;
```

Action rules:

- `NOT_LOGGED_IN`: show primary `Login`, secondary `Open`; hide `Manage login`.
- `LOGGED_IN`: show `Open`/`Manage login`, `Reset login`, and `Remove` when `canRemove`.
- `UNAVAILABLE`: show `Open` and a refresh/retry path; `Login` can be shown only after a new probe reports `NOT_LOGGED_IN`.
- `CHECKING`: disable destructive actions.
- Always render `+ Add browser` below the list.

`Login` awaits the main-process login operation. The Chrome window owns the credential entry; the React form must never contain email/password inputs.

- [ ] **Step 5: Add confirmations for destructive profile actions**

Use an existing project dialog if available; otherwise use the current Desktop-safe confirmation pattern. Copy must name the selected browser and distinguish operations:

```text
Reset Browser 2 login? This removes only this browser's saved Chrome login on this device.
Remove Browser 2? This removes this browser profile from NarrativeX on this device. Other browsers are unchanged.
```

Never reuse the generic `Reset all personalized settings` action to delete browser profiles.

- [ ] **Step 6: Keep `SettingsScreen.tsx` small**

Compose:

```tsx
<GeminiBrowserSettings />
<GeminiConcurrencySettings ... />
```

The screen may keep Runtime & Storage, Project Defaults and high-level notices, but it must not absorb browser registry/auth/scheduler logic.

- [ ] **Step 7: Run GREEN and renderer checks**

```bash
node --experimental-strip-types --experimental-transform-types --test test/personalized-settings-contract.test.mjs
npm run type-check
npm run build
```
Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```bash
git add app/desktop/src/renderer/features/settings/components/GeminiBrowserSettings.tsx app/desktop/src/renderer/features/settings/components/GeminiConcurrencySettings.tsx app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx app/desktop/test/personalized-settings-contract.test.mjs
git commit -m "feat: manage Gemini browser logins from settings"
```

---

### Task 8: Finish migration/docs and verify the complete Desktop feature

**Files:**
- Modify: `app/desktop/README.md`
- Modify: `documentation/decisions/ADR-0021-desktop-gemini-web-image-generation.md`
- Modify: `docs/superpowers/specs/2026-09-01-multi-gemini-browser-pool-design.md`
- Modify: PR #416 body after verification.

**Interfaces:** None; this task verifies the composed feature.

- [ ] **Step 1: Update docs to describe the new invariant**

Replace the old invariant:

```text
one authenticated Chrome process/profile
```

with:

```text
one Gemini browser profile by default, user-expandable to multiple isolated Chrome profiles; each browser owns one Chrome process/session and reusable tabs, while Character/Storyboard concurrency remains global per NarrativeX user.
```

Document that Google credentials are never stored by NarrativeX and that Reset Login is per browser.

- [ ] **Step 2: Mark the written spec implemented only after verification**

Change its status from `approved in chat, pending written-spec review` to `implemented` only if all automated checks and runtime verification below succeed. If runtime verification is blocked, use `implemented; runtime verification pending` instead.

- [ ] **Step 3: Run focused tests**

```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test \
  test/gemini-browser-registry.test.mjs \
  test/gemini-chrome-session.test.mjs \
  test/gemini-browser-storage.test.mjs \
  test/gemini-web-automation-pool.test.mjs \
  test/gemini-browser-pool.test.mjs \
  test/gemini-browser-ipc-contract.test.mjs \
  test/desktop-preferences.test.mjs \
  test/personalized-settings-contract.test.mjs \
  test/runtime-hardening.test.mjs
```
Expected: all PASS.

- [ ] **Step 4: Run the complete Desktop gate**

```bash
npm run check
```
Expected: dependency-lock check, all Node tests, TypeScript checks and Electron build PASS.

- [ ] **Step 5: Perform real runtime verification**

Run:
```bash
npm run dev
```

Verify in the Desktop UI:

1. Fresh/current user sees exactly Browser 1.
2. Existing Browser 1 login is preserved after legacy migration if the old profile existed.
3. If Browser 1 is logged out, Settings shows `Login`; pressing it opens only Browser 1 and status changes to `Logged in` only after Gemini composer is available.
4. Add Browser 2; it initially shows `Not logged in` after probe.
5. Login Browser 2 with either the same or a different Google account.
6. Restart NarrativeX; both browser profiles retain Chrome-owned sessions unless Google itself requires re-authentication.
7. With Character=2 and Storyboard=4, start enough generation work to exercise both browsers and confirm total concurrency never exceeds 2/4 respectively.
8. Reset Browser 2 login and confirm Browser 1 remains authenticated.
9. Remove Browser 2 and confirm Browser 1 remains usable.
10. Attempt destructive action during an active Browser 1 lease and confirm it is rejected.

- [ ] **Step 6: Inspect process/profile behavior during runtime verification**

For two active browser profiles, confirm there are two distinct Chrome browser hosts with different `--user-data-dir` and remote-debugging ports, while each host may contain multiple renderer subprocesses/tabs. Do not interpret Chrome renderer/helper processes as extra NarrativeX browser profiles.

- [ ] **Step 7: Commit docs**

```bash
git add app/desktop/README.md documentation/decisions/ADR-0021-desktop-gemini-web-image-generation.md docs/superpowers/specs/2026-09-01-multi-gemini-browser-pool-design.md
git commit -m "docs: document multi-browser Gemini profiles"
```

- [ ] **Step 8: Refresh PR #416 and CI**

Update the PR body to mention:

```text
- one Gemini browser by default, user-expandable from Settings;
- independent persistent Chrome login profiles;
- automatic authenticated-browser scheduling;
- global Character/Storyboard concurrency remains unchanged by browser count;
- per-browser Login, Reset Login and Remove controls;
- legacy single-browser profile migration.
```

Keep PR #416 draft until the latest head's Desktop check, Repository gates, Backend verify, and AI worker checks have completed. Do not report the feature complete based on stale CI from an earlier head.

---

## Self-Review Result

- Spec coverage: browser registry/default, Add Browser, independent persistent login, derived auth status, Settings actions, automatic scheduling, global concurrency, active-lease safety, user isolation, legacy migration, no credential exposure, reset semantics, docs and runtime verification are each assigned to a task.
- Placeholder scan: no TBD/TODO/"implement later" steps remain.
- Type consistency: `GeminiBrowserAuthStatus`, `GeminiBrowserProfile`, `GeminiBrowserView`, `GeminiChromeSession`, `GeminiBrowserHost`, and `GeminiBrowserPool` names/signatures are defined before downstream tasks consume them.
- File-size constraint: Chrome/CDP lifecycle, browser storage, host scheduling, IPC, browser UI and concurrency UI are explicitly split into focused modules rather than expanding `gemini-web-automation.ts`, `desktop-preferences.ts`, or `SettingsScreen.tsx`.