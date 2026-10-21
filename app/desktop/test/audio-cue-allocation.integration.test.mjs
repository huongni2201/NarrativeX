import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

test("audio cue selection preserves drafts and CAS through refetch and save conflicts", { skip: !process.env.AUDIO_WORKSPACE_BROWSER_TEST }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || "playwright/test");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const server = await createServer({ configFile: false, root: desktop,
    cacheDir: resolve(desktop, `../../.runtime/audio-cue-test-cache-${process.pid}`),
    plugins: [tailwindcss()], esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": join(desktop, "src/renderer") } }, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.AUDIO_WORKSPACE_BROWSER_EXECUTABLE, headless: true });
    const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const url = scenario => `${server.resolvedUrls.local[0]}test/fixtures/audio-cue-allocation.html?scenario=${scenario}`;
    await page.goto(url("multiple"));
    const first = page.getByRole("combobox", { name: "Shot phát cue 1" });
    const second = page.getByRole("combobox", { name: "Shot phát cue 2" });
    const save = page.getByRole("button", { name: "Lưu phân bổ", exact: true });
    await expect(first).toBeVisible();
    await expect(save).toBeDisabled();
    await first.selectOption("shot-0");
    await second.selectOption("shot-1");
    await expect(page.getByText("2 cue đã chọn · Chưa lưu", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cập nhật từ cửa sổ khác" }).click();
    await expect(first).toHaveValue("shot-0");
    await save.click();
    await expect(page.getByRole("alert")).toContainText("cửa sổ khác");
    await expect(first).toHaveValue("shot-0");
    assert.equal(JSON.parse(await page.evaluate(() => sessionStorage.getItem("allocation-input"))).expectedRowVersion, 0);
    await page.getByRole("button", { name: "Bỏ thay đổi và tải lại" }).click();
    await expect(first).toHaveValue("shot-1");
    await first.selectOption("shot-0");
    await save.click();
    await expect(page.getByText("2 cue đã lưu", { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    if (process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR, "audio-cue-saved.png"), fullPage: true });
    await page.goto(url("single"));
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByText("DIALOGUE · Lan", { exact: true })).toBeVisible();
    await expect(page.getByText("DIALOGUE · Nam", { exact: true })).toBeVisible();
    await expect(page.getByText("Tự động dùng toàn bộ cue", { exact: true })).toBeVisible();
    await expect(save).toHaveCount(0);
    if (process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR, "audio-cue-single-shot.png"), fullPage: true });
    await page.goto(url("stale"));
    await expect(page.getByRole("alert")).toContainText("AudioCue đã đổi");
    await save.click();
    await expect(page.getByText("2 cue đã lưu", { exact: true })).toBeVisible();
    const repaired = JSON.parse(await page.evaluate(() => sessionStorage.getItem("allocation-input")));
    assert.deepEqual(repaired.allocations.map(item => item.shotId), ["shot-0", "shot-0"]);
    await page.goto(url("error"));
    await expect(page.getByRole("alert")).toContainText("Không tải được");
    await page.getByRole("button", { name: "Thử tải lại" }).click();
    await expect(first).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR, "audio-cue-selection.png"), fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
