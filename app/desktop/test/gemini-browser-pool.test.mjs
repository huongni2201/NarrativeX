import test from "node:test";
import assert from "node:assert/strict";
import { GeminiBrowserPool } from "../src/main/gemini-web/gemini-browser-pool.ts";

function profile(id, name) {
  return { id, name, createdAt: "2026-09-01T00:00:00.000Z" };
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
      const next = profile(`browser-${browsers.length + 1}`, `Browser ${browsers.length + 1}`);
      browsers = [...browsers, next];
      return this.get();
    },
    async removeGeminiBrowser(browserId) {
      if (browsers.length <= 1) throw new Error("At least one Gemini browser must remain.");
      browsers = browsers.filter((browser) => browser.id !== browserId);
      return this.get();
    },
  };
}

function fakeHost(browserId, status = "LOGGED_IN", hooks = {}) {
  let active = 0;
  let calls = 0;
  let maxActive = 0;
  return {
    browserId,
    async authStatus() { return status; },
    async open() {},
    async login() { status = "LOGGED_IN"; },
    async generateImage(lane, prompt) {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
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
    stats() { return { calls, maxActive }; },
    setStatus(next) { status = next; },
  };
}

test("two browsers do not multiply Character concurrency", async () => {
  const prefs = preferences([profile("browser-1", "Browser 1"), profile("browser-2", "Browser 2")]);
  let totalActive = 0;
  let maxTotalActive = 0;
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) =>
    fakeHost(browser.id, "LOGGED_IN", {
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

test("scheduler ignores logged-out and unavailable browsers", async () => {
  const prefs = preferences([profile("browser-1", "Browser 1"), profile("browser-2", "Browser 2")]);
  const hosts = new Map();
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) => {
    const host = fakeHost(browser.id, browser.id === "browser-1" ? "NOT_LOGGED_IN" : "LOGGED_IN");
    hosts.set(browser.id, host);
    return host;
  });

  const result = await pool.generateImage("CHARACTER", "a");
  assert.match(result.sourcePath, /^browser-2:/);
  assert.equal(hosts.get("browser-1").stats().calls, 0);
  assert.equal(hosts.get("browser-2").stats().calls, 1);
});

test("equal-load scheduling distributes work across authenticated browsers", async () => {
  const prefs = preferences([profile("browser-1", "Browser 1"), profile("browser-2", "Browser 2")]);
  const hosts = new Map();
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) => {
    const host = fakeHost(browser.id);
    hosts.set(browser.id, host);
    return host;
  });

  await Promise.all([
    pool.generateImage("CHARACTER", "a"),
    pool.generateImage("CHARACTER", "b"),
  ]);
  assert.equal(hosts.get("browser-1").stats().calls, 1);
  assert.equal(hosts.get("browser-2").stats().calls, 1);
});

test("generation failure is not replayed on another browser", async () => {
  const prefs = preferences([profile("browser-1", "Browser 1"), profile("browser-2", "Browser 2")], { characterTabs: 1, storyboardTabs: 1 });
  let secondCalls = 0;
  const pool = new GeminiBrowserPool("/tmp/gemini", prefs, ({ browser }) => {
    if (browser.id === "browser-1") {
      return {
        browserId: browser.id,
        async authStatus() { return "LOGGED_IN"; },
        async open() {},
        async login() {},
        async generateImage() { throw new Error("submitted then failed"); },
        activeLeaseCount() { return 0; },
        async stop() {},
      };
    }
    return {
      browserId: browser.id,
      async authStatus() { return "LOGGED_IN"; },
      async open() {},
      async login() {},
      async generateImage() { secondCalls += 1; return { sourcePath: "second", captureMethod: "DOWNLOAD" }; },
      activeLeaseCount() { return 0; },
      async stop() {},
    };
  });

  await assert.rejects(() => pool.generateImage("CHARACTER", "a"), /submitted then failed/);
  assert.equal(secondCalls, 0);
});
