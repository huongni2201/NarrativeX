import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

test("a catalog voice can be previewed, selected for narration and tracked through completion", { skip: !process.env.AUDIO_WORKSPACE_BROWSER_TEST }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || "playwright/test");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const server = await createServer({ configFile: false, root: desktop,
    cacheDir: resolve(desktop, `../../.runtime/narration-selection-cache-${process.pid}`),
    plugins: [tailwindcss()], esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": join(desktop, "src/renderer") } }, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.AUDIO_WORKSPACE_BROWSER_EXECUTABLE, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      window.Audio = class {
        constructor(url) { sessionStorage.setItem("played-sample", url); }
        play() { return Promise.resolve(); }
        pause() {}
      };
    });
    await page.goto(`${server.resolvedUrls.local[0]}test/fixtures/audio-workspace.html?scenario=narration`);
    await page.getByRole("button", { name: "Lời kể", exact: true }).click();
    const rate = page.getByRole("spinbutton", { name: "Tốc độ đọc", exact: true });
    const generate = page.getByRole("button", { name: "Tạo lời kể", exact: true });
    await rate.fill("4");
    await expect(generate).toBeDisabled();
    await rate.fill("1.2");
    await page.getByRole("button", { name: "Thêm giọng dùng chung (Local)", exact: true }).click();
    await expect(page.getByText(/Đang dùng file tham chiếu giong-mau.wav/)).toBeVisible();
    await page.getByRole("button", { name: "Dùng giọng trong thư viện", exact: true }).click();
    await expect(page.getByText("Giọng sẽ dùng: Minh Quân Pro.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Thêm giọng dùng chung (Local)", exact: true }).click();
    await page.getByRole("button", { name: "Giọng VieNeu", exact: true }).click();
    await page.getByRole("button", { name: "Dùng giọng Giọng bà kể tạo lời kể", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Giọng người kể", exact: true })).toContainText("Giọng bà kể");
    await expect(rate).toHaveValue("1");
    await expect(rate).toBeDisabled();
    await expect(page.getByText("Giọng sẽ dùng: Giọng bà kể.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nghe thử giọng đã chọn", exact: true }).click();
    await expect(page.getByRole("button", { name: "Dừng nghe thử", exact: true })).toBeVisible();
    const preview = JSON.parse(await page.evaluate(() => sessionStorage.getItem("narration-preview-body")));
    assert.equal(preview.voiceId, "custom-narrator");
    assert.equal(preview.voiceReference, undefined);
    await page.getByRole("button", { name: "Giọng VieNeu", exact: true }).click();
    await page.getByRole("button", { name: "Lời kể", exact: true }).click();
    await expect(page.getByRole("button", { name: "Nghe thử giọng đã chọn", exact: true })).toBeVisible();
    await page.evaluate(() => sessionStorage.setItem("fail-narration", "1"));
    await generate.click();
    await expect(page.getByText("Lưu nội dung chương trước khi tạo lời kể.", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Giọng người kể", exact: true })).toContainText("Giọng bà kể");
    await page.evaluate(() => sessionStorage.removeItem("fail-narration"));
    await generate.click();
    await expect(page.getByRole("button", { name: "Đang tạo lời kể…", exact: true })).toBeDisabled();
    assert.deepEqual(JSON.parse(await page.evaluate(() => sessionStorage.getItem("narration-body"))), { voiceId: "custom-narrator", speakingRate: 1, voiceReference: null });
    assert.equal(await page.evaluate(() => sessionStorage.getItem("narration-path")), "/api/v1/projects/fixture/chapters/chapter/narration-jobs");
    await page.evaluate(() => window.dispatchEvent(new Event("complete-narration")));
    await expect(page.getByText("Đã tạo xong lời kể.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mở Editor để nghe lời kể", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tạo lại lời kể", exact: true })).toBeEnabled();
    if (process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR, "narration-voice-selected.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.dataset.theme = "light");
    await page.setViewportSize({ width: 1000, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => sessionStorage.setItem("fail-narration", "503"));
    await page.getByRole("button", { name: "Tạo lại lời kể", exact: true }).click();
    await expect(page.getByText(/Chưa xác nhận được kết quả gửi yêu cầu/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tạo lại lời kể", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Kiểm tra tác vụ audio", exact: true })).toBeVisible();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
