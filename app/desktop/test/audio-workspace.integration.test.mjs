import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

test("audio workspace saves character voices, preserves drafts on errors and separates narration from the library", { skip: !process.env.AUDIO_WORKSPACE_BROWSER_TEST }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || "playwright/test");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const server = await createServer({ configFile: false, root: desktop, cacheDir: resolve(desktop,"../../.runtime/audio-test-cache"),
    plugins: [tailwindcss()], optimizeDeps: { entries: ["test/fixtures/audio-workspace.html"] }, esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": join(desktop,"src/renderer") } }, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.AUDIO_WORKSPACE_BROWSER_EXECUTABLE, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    const url = scenario => `${server.resolvedUrls.local[0]}test/fixtures/audio-workspace.html?scenario=${scenario}`;
    await page.goto(url("normal"));
    const description = page.getByLabel("Mô tả giọng nói", { exact: false });
    const save = page.getByRole("button", { name: "Lưu hồ sơ giọng", exact: true });
    await expect(save).toBeDisabled();
    await description.fill("Giọng nữ trẻ, trong và ấm.");
    await page.getByRole("button", { name: "Thư viện giọng", exact: true }).click();
    await page.getByRole("button", { name: "Giọng nhân vật", exact: true }).click();
    await expect(description).toHaveValue("Giọng nữ trẻ, trong và ấm.");
    await page.getByLabel("Vùng giọng", { exact: false }).fill("Miền Bắc");
    await save.click();
    await expect(page.getByRole("status")).toContainText("Đã lưu và đặt làm giọng đang dùng");
    await expect(page.getByText("Đang dùng hồ sơ giọng phiên bản 1.")).toBeVisible();
    await expect(save).toBeDisabled();
    assert.equal(await page.evaluate(() => sessionStorage.getItem("voice-save-count")), "1");
    await page.evaluate(() => sessionStorage.setItem("fail-voice-save","1"));
    await description.fill("Bản nháp cần giữ lại khi lỗi."); await save.click();
    await expect(page.getByRole("alert")).toContainText("Nhân vật đã thay đổi");
    await expect(description).toHaveValue("Bản nháp cần giữ lại khi lỗi.");
    await page.getByRole("button", { name: "Khôi phục bản đã lưu" }).click();
    await expect(description).toHaveValue("Giọng nữ trẻ, trong và ấm.");
    await page.getByRole("button", { name: "Lời kể", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Lời kể theo chương" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Chương đọc", exact: true })).toContainText("Chương thử");
    await expect(page.getByRole("combobox", { name: "Giọng người kể", exact: true })).toContainText("Minh Quân Pro");
    await page.getByRole("button", { name: "Thư viện giọng", exact: true }).click();
    await page.getByRole("textbox", { name: "Tìm voice" }).fill("Không có giọng này");
    await expect(page.getByText("Không tìm thấy voice", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Tìm voice" }).fill("");
    await page.getByRole("button", { name: "Phát thử Minh Quân Pro" }).first().click();
    await expect(page.getByRole("status")).toContainText("Voice này chưa có sample audio.");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.goto(url("error"));
    await expect(page.getByRole("alert")).toContainText("Không tải được hồ sơ giọng");
    await page.goto(url("empty"));
    await expect(page.getByText("Chưa có nhân vật", { exact: true })).toBeVisible();
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});

test("VieNeu voices tab lists presets, creates and removes custom voices and reports rejected references", { skip: !process.env.AUDIO_WORKSPACE_BROWSER_TEST }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || "playwright/test");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const server = await createServer({ configFile: false, root: desktop, cacheDir: resolve(desktop,"../../.runtime/audio-test-cache"),
    plugins: [tailwindcss()], optimizeDeps: { entries: ["test/fixtures/audio-workspace.html"] }, esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": join(desktop,"src/renderer") } }, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.AUDIO_WORKSPACE_BROWSER_EXECUTABLE, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    const url = scenario => `${server.resolvedUrls.local[0]}test/fixtures/audio-workspace.html?scenario=${scenario}`;
    const submit = page.getByRole("button", { name: "Tạo giọng", exact: true });
    const pickFile = () => page.getByRole("button", { name: /Chọn file/ }).click();

    await page.goto(url("normal"));
    await page.getByRole("button", { name: "Giọng VieNeu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Giọng VieNeu" })).toBeVisible();
    const builtIn = page.getByRole("region", { name: "Giọng có sẵn của VieNeu" });
    await expect(builtIn.getByRole("listitem")).toHaveCount(2);
    await expect(builtIn.getByRole("listitem").first()).toContainText("Minh Quân Pro");
    await expect(builtIn.getByText("Nổi bật")).toBeVisible();
    await expect(builtIn).toContainText("Miền Bắc");
    if (process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR, "audio-workspace-vieneu-empty.png") });
    await expect(page.getByText("Chưa có giọng tự tạo")).toBeVisible();

    await expect(submit).toBeDisabled();
    await page.getByLabel("Tên giọng").fill("Giọng bà kể");
    await expect(submit).toBeDisabled();
    await pickFile();
    await expect(page.getByText("giong-mau.wav", { exact: true })).toBeVisible();
    await expect(page.getByText("File hợp lệ, sẵn sàng tạo giọng.")).toBeVisible();
    await page.getByRole("combobox", { name: "Giới tính" }).click();
    await page.getByRole("option", { name: "Nữ" }).click();
    await submit.click();
    const custom = page.getByRole("region", { name: "Giọng của bạn" });
    await expect(custom.getByRole("listitem")).toHaveCount(1);
    await expect(custom).toContainText("Giọng bà kể");
    await expect(custom).toContainText("Nữ");
    await expect(custom).toContainText("Giọng mẫu: giong-mau.wav");
    await expect(page.getByRole("status").filter({ hasText: "Đã tạo giọng" })).toBeVisible();
    if (process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.AUDIO_WORKSPACE_SCREENSHOT_DIR, "audio-workspace-vieneu-created.png") });
    await expect(page.getByLabel("Tên giọng")).toHaveValue("");
    assert.deepEqual(JSON.parse(await page.evaluate(() => sessionStorage.getItem("custom-voice-body"))), { name: "Giọng bà kể", referenceAssetId: "reference-1", gender: "FEMALE" });

    await page.getByLabel("Tên giọng").fill("giọng BÀ kể");
    await pickFile();
    await expect(page.getByText("File hợp lệ, sẵn sàng tạo giọng.")).toBeVisible();
    await submit.click();
    await expect(page.getByRole("alert")).toContainText("Đã có giọng tên");
    await expect(page.getByLabel("Tên giọng")).toHaveValue("giọng BÀ kể");

    await page.getByRole("button", { name: "Lời kể", exact: true }).click();
    await page.getByRole("combobox", { name: "Giọng người kể", exact: true }).click();
    await expect(page.getByRole("option", { name: "Giọng bà kể" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Giọng VieNeu", exact: true }).click();
    await page.getByRole("button", { name: "Xóa giọng Giọng bà kể" }).click();
    await page.getByRole("button", { name: "Hủy" }).click();
    await expect(custom.getByRole("listitem")).toHaveCount(1);
    await page.getByRole("button", { name: "Xóa giọng Giọng bà kể" }).click();
    await page.getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(page.getByText("Chưa có giọng tự tạo")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Đã xóa giọng" })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.goto(url("reference-rejected"));
    await page.getByRole("button", { name: "Giọng VieNeu", exact: true }).click();
    await page.getByLabel("Tên giọng").fill("Giọng lỗi");
    await pickFile();
    await expect(page.getByText("File bị từ chối.", { exact: false })).toBeVisible();
    await expect(submit).toBeDisabled();

    await page.goto(url("no-vieneu"));
    await page.getByRole("button", { name: "Giọng VieNeu", exact: true }).click();
    await expect(page.getByText("Chưa có giọng VieNeu", { exact: true })).toBeVisible();
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
