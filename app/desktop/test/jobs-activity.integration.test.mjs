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

test("Jobs exposes complete stored errors, copies them and distinguishes legacy logs", { skip: !process.env.ANALYSIS_ACCOUNTS_BROWSER_TEST }, async () => {
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
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    const open = async scenario => {
      await page.goto(`${server.resolvedUrls.local[0]}test/fixtures/jobs-activity.html?scenario=${scenario}`);
      const row = page.getByRole("button", { name: "Xem chi tiết CHAPTER_ANALYZE job-failed", exact: true });
      await row.focus(); await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Xem đầy đủ lỗi", exact: true }).click();
    };
    await open("normal");
    const detail = page.getByLabel("Nội dung lỗi 1", { exact: true });
    await expect(detail).toContainText("print timeout after 10m0s");
    await expect(detail).toContainText("FINAL ERROR LINE");
    await expect(detail).toContainText("Giai đoạn: STORY · Cửa sổ 2/3");
    await expect(page.getByText("OTHER JOB PRIVATE DETAIL", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Sao chép chi tiết lỗi", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Đã sao chép" })).toBeVisible();
    const copied = await page.evaluate(() => sessionStorage.getItem("copied-job-error"));
    assert.match(copied, /Job ID: job-failed/u); assert.match(copied, /Giai đoạn: STORY · Cửa sổ 2\/3/u); assert.match(copied, /FINAL ERROR LINE/u);
    assert.doesNotMatch(copied, /OTHER JOB PRIVATE DETAIL/u);
    await page.setViewportSize({ width: 640, height: 850 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await open("legacy");
    await expect(page.getByText("Nhật ký CLI gần đây — chưa gắn với Job ID, không khẳng định thuộc tác vụ này.", { exact: true })).toBeVisible();
    await open("log-error");
    await expect(page.getByRole("alert")).toContainText("Không đọc được nhật ký lỗi");
    await open("empty");
    await expect(page.getByText("Không còn nhật ký chi tiết", { exact: false })).toBeVisible();
    await open("light"); await expect(detail).toBeVisible();
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
