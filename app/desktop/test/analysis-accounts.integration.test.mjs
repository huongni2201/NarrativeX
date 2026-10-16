import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

test("analysis model survives cached options, navigation and reload", { skip: !process.env.ANALYSIS_ACCOUNTS_BROWSER_TEST }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || "playwright/test");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const server = await createServer({ configFile: false, root: desktop, cacheDir: resolve(desktop, "../../.runtime/analysis-test-cache"),
    plugins: [tailwindcss()], optimizeDeps: { entries: ["test/fixtures/analysis-accounts.html"] },
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": join(desktop, "src/renderer") } }, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.ANALYSIS_ACCOUNTS_BROWSER_EXECUTABLE, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.resolvedUrls.local[0]}test/fixtures/analysis-accounts.html`);
    const model = page.getByRole("combobox", { name: "Model agy" });
    await expect(model).toContainText("gemini-3.8-flash-high");
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Toggle account" }).click();
      await expect(model).toHaveCount(0);
      await page.getByRole("button", { name: "Toggle account" }).click();
      await expect(model).toContainText("gemini-3.8-flash-high");
    }
    assert.equal(await page.evaluate(() => sessionStorage.getItem("analysis-config")), null, "navigation must not save a new configuration");
    await model.click();
    await page.getByRole("option", { name: "claude-sonnet-4-6" }).click();
    await page.getByRole("button", { name: "Lưu cấu hình", exact: true }).click();
    await page.getByText("Đã lưu cấu hình cho các lượt phân tích mới.", { exact: true }).waitFor();
    await page.reload();
    await expect(model).toContainText("claude-sonnet-4-6");
    await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem("analysis-config"));
      sessionStorage.setItem("analysis-config", JSON.stringify({ ...saved, model: "saved-unavailable-model" }));
    });
    await page.reload();
    await expect(model).toContainText("saved-unavailable-model (không có trong agy)");
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
