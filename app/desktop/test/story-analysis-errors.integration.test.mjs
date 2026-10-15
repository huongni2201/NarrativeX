import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

test("Account distinguishes permission denial, rejected authentication and invalid refresh grants", { skip: !process.env.STORY_ANALYSIS_BROWSER_TEST }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const output = resolve(desktop, "../../.tmp/antigravity-auth-errors");
  await mkdir(output, { recursive: true });
  const server = await createServer({ configFile: false, root: desktop, cacheDir: join(output, "vite-cache"),
    plugins: [tailwindcss()], optimizeDeps: { entries: ["test/fixtures/story-analysis-errors.html"] },
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": join(desktop, "src/renderer") } },
    server: { host: "127.0.0.1", port: 0 } });
  const report = { evidence: "ISOLATED_FIXTURE_ONLY", consoleErrors: [], failedRequests: [], screenshots: [] };
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true, channel: process.env.STORY_ANALYSIS_BROWSER_CHANNEL || "chrome" });
    const page = await browser.newPage();
    page.on("pageerror", error => report.consoleErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    page.on("requestfailed", request => report.failedRequests.push(request.url()));
    const fixture = `${server.resolvedUrls.local[0]}test/fixtures/story-analysis-errors.html`;
    for (const scenario of ["403", "401", "invalid_grant"]) {
      for (const theme of ["dark", "light"]) {
        for (const width of [1100, 390]) {
          await page.setViewportSize({ width, height: 1100 });
          await page.goto(`${fixture}?scenario=${scenario}&theme=${theme}`);
          await page.getByRole("heading", { name: "Tài khoản đã đăng nhập", exact: true }).waitFor();
          const login = page.getByRole("button", { name: "Đăng nhập lại", exact: true });
          if (scenario === "403") {
            await page.getByText(/Antigravity từ chối quyền truy cập/).waitFor();
            await page.getByText("Antigravity · HTTP 403", { exact: true }).waitFor();
            await page.getByText("0/1 tài khoản sẵn sàng", { exact: true }).waitFor();
            assert.equal(await login.count(), 0);
            await page.getByRole("button", { name: "Làm mới", exact: true }).click();
            await page.getByText("Antigravity · HTTP 403", { exact: true }).waitFor();
          } else {
            await login.waitFor();
            await page.getByText("Không xác thực được tài khoản Google. Hãy đăng nhập lại tài khoản này.", { exact: true }).waitFor();
            await page.getByText(scenario === "401" ? "Antigravity · HTTP 401" : "Google OAuth · HTTP 400 · INVALID_GRANT", { exact: true }).waitFor();
          }
          assert.doesNotMatch(await page.locator("body").innerText(), /bị thu hồi/);
          assert.equal(await page.getByRole("alert").count(), 0, "Fixture API must match the actual backend envelope");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const screenshot = join(output, `${scenario}-${theme}-${width}.png`);
          await page.screenshot({ path: screenshot, fullPage: true });
          report.screenshots.push(screenshot);
          if (scenario !== "403") {
            await login.click();
            await page.getByText("Đã thêm tài khoản Google. Có thể thêm tài khoản khác để chạy song song.", { exact: true }).waitFor();
            assert.equal(await login.count(), 0);
            assert.doesNotMatch(await page.locator("body").innerText(), /HTTP 40[013]|INVALID_GRANT/);
          }
        }
      }
    }
    await page.goto(`${fixture}?scenario=empty`);
    await page.getByText("Chưa có tài khoản", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Đăng nhập lại", exact: true }).count(), 0);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.failedRequests, []);
    report.status = "PASS";
  } finally {
    await browser?.close();
    await server.close();
    await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  }
});
