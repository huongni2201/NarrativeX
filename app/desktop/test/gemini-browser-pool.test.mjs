import test from "node:test";
import assert from "node:assert/strict";
import { GeminiBrowserPool } from "../src/main/gemini-web/gemini-browser-pool.ts";

function profile(id, name, loginConfirmed = true) {
  return { id, name, createdAt: "2026-09-01T00:00:00.000Z", loginConfirmed };
}

function preferences(initialBrowsers, counts = { characterTabs: 2, storyboardTabs: 4 }) {
  let browsers = [...initialBrowsers];
  return {
    async get() {
      return {
        userId: "user-a",
        gemini: { ...counts, browsers, environmentDefaults: counts },
        window: null,
      };
    },
    async addGeminiBrowser() {
      const next = profile(`browser-${browsers.length + 1}`, `Browser ${browsers.length + 1}`, false);
      browsers = [...browsers, next];
      return this.get();
    },
    async removeGeminiBrowser(browserId) {
      if (browsers.length <= 1) throw new Error("At least one Gemini browser must remain.");
      browsers = browsers.filter((browser) => browser.id !== browserId);
      return this.get();
    },
    async setGeminiBrowserLoginConfirmed(browserId, loginConfirmed) {
      browsers = browsers.map((browser) => browser.id === browserId ? { ...browser, loginConfirmed } : browser);
      return this.get();
    },
  };
}

function fakeHost(browserId, hooks = {}) {
  let active = 0;
  let calls = 0;
  return {
    browserId,
    async authStatus() { throw new Error("manual status must not probe the browser DOM"); },
    async open() {},
    async login() { throw new Error("manual confirmation replaces automatic login probing"); },
    async generateImage(lane, prompt) {
      calls += 1;
      active += 1;
      hooks.onStart?.();
      try {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { sourcePath: `${browserId}:${lane}:${prompt}`, captureMethod: "DOWNLOAD" };
      } finally {
        active -= 1;
        hooks.onFinish?.();
      }
    },
    activeLeaseCount() { return active; },
    async stop() {},
    stats() { return { calls }; },
  };
}

test("browser list reflects manual confirmation without probing Gemini DOM", async () => {
  const prefs = preferences([
    profile("browser-1", "Browser 1", true),
    profile("browser-2", "Browser 2", false),
  ]);
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) => fakeHost(browser.id));

  const views = await pool.list();
  assert.equal(views[0].authStatus, "LOGGED_IN");
  assert.equal(views[1].authStatus, "NOT_LOGGED_IN");
});

test("scheduler ignores browsers that user has not confirmed as logged in", async () => {
  const prefs = preferences([
    profile("browser-1", "Browser 1", false),
    profile("browser-2", "Browser 2", true),
  ]);
  const hosts = new Map();
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) => {
    const host = fakeHost(browser.id);
    hosts.set(browser.id, host);
    return host;
  });

  const result = await pool.generateImage("CHARACTER", "a");
  assert.match(result.sourcePath, /^browser-2:/);
  assert.equal(hosts.get("browser-1").stats().calls, 0);
  assert.equal(hosts.get("browser-2").stats().calls, 1);
});

test("two confirmed browsers do not multiply Character concurrency", async () => {
  const prefs = preferences([profile("browser-1", "Browser 1"), profile("browser-2", "Browser 2")]);
  let totalActive = 0;
  let maxTotalActive = 0;
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) =>
    fakeHost(browser.id, {
      onStart() {
        totalActive += 1;
        maxTotalActive = Math.max(maxTotalActive, totalActive);
      },
      onFinish() {
        totalActive -= 1;
      },
    }),
  );

  await Promise.all([
    pool.generateImage("CHARACTER", "a"),
    pool.generateImage("CHARACTER", "b"),
    pool.generateImage("CHARACTER", "c"),
    pool.generateImage("CHARACTER", "d"),
  ]);
  assert.equal(maxTotalActive, 2);
});

test("generation failure is not replayed on another browser", async () => {
  const prefs = preferences([profile("browser-1", "Browser 1"), profile("browser-2", "Browser 2")], { characterTabs: 1, storyboardTabs: 1 });
  let secondCalls = 0;
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) => {
    if (browser.id === "browser-1") {
      return {
        ...fakeHost(browser.id),
        async generateImage() { throw new Error("submitted then failed"); },
      };
    }
    return {
      ...fakeHost(browser.id),
      async generateImage() { secondCalls += 1; return { sourcePath: "second", captureMethod: "DOWNLOAD" }; },
    };
  });

  await assert.rejects(() => pool.generateImage("CHARACTER", "a"), /submitted then failed/);
  assert.equal(secondCalls, 0);
});

test("auth-required generation automatically removes the browser from the eligible pool", async () => {
  const prefs = preferences([profile("browser-1", "Browser 1", true)], { characterTabs: 1, storyboardTabs: 1 });
  let calls = 0;
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) => ({
    ...fakeHost(browser.id),
    async generateImage() {
      calls += 1;
      const error = new Error("[GEMINI_AUTH_REQUIRED] Sign in again.");
      error.name = "GEMINI_AUTH_REQUIRED";
      throw error;
    },
  }));

  await assert.rejects(() => pool.generateImage("CHARACTER", "a"), /GEMINI_AUTH_REQUIRED/);
  assert.equal((await prefs.get()).gemini.browsers[0].loginConfirmed, false);
  await assert.rejects(() => pool.generateImage("CHARACTER", "b"), /No Gemini browser is marked as signed in/);
  assert.equal(calls, 1);
});

test("configured tab totals are divided evenly across confirmed browser hosts", async () => {
  const prefs = preferences(
    [profile("browser-1", "Browser 1"), profile("browser-2", "Browser 2")],
    { characterTabs: 2, storyboardTabs: 5 },
  );
  const tabCountsByBrowser = new Map();
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser, getTabCounts }) => {
    tabCountsByBrowser.set(browser.id, getTabCounts);
    return fakeHost(browser.id);
  });

  await pool.list();

  assert.deepEqual(await tabCountsByBrowser.get("browser-1")(), {
    characterTabs: 1,
    storyboardTabs: 3,
  });
  assert.deepEqual(await tabCountsByBrowser.get("browser-2")(), {
    characterTabs: 1,
    storyboardTabs: 2,
  });
});
