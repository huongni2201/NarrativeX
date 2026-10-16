import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

test("the Jobs screen says whether the agy process of a running analysis really exists", { skip: !process.env.ANALYSIS_ACCOUNTS_BROWSER_TEST }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || "playwright/test");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const server = await createServer({ configFile: false, root: desktop, cacheDir: resolve(desktop, "../../.runtime/jobs-test-cache"),
    plugins: [tailwindcss()], optimizeDeps: { entries: ["test/fixtures/jobs-activity.html"] },
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": join(desktop, "src/renderer") } }, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.ANALYSIS_ACCOUNTS_BROWSER_EXECUTABLE, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const url = scenario => `${server.resolvedUrls.local[0]}test/fixtures/jobs-activity.html?scenario=${scenario}`;
    await page.goto(url("alive"));
    await expect(page.getByRole("status")).toContainText(/agy đang chạy · PID 28224 · 4 phút \d+ giây/u);
    await page.goto(url("missing"));
    await expect(page.getByRole("status")).toContainText("Chưa thấy tiến trình agy");
    await page.goto(url("dead"));
    await expect(page.getByRole("status")).toContainText("đã dừng trước khi trả kết quả");
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
