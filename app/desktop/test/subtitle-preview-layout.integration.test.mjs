import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

// Opt in because this real renderer fixture requires browser automation.
test("subtitle preview matches output geometry and opacity", { skip: !process.env.SUBTITLE_PREVIEW_BROWSER_TEST }, async (t) => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const { PNG } = require(process.env.PNGJS_MODULE || "pngjs");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const output = resolve(desktop, "../../.tmp/subtitle-preview-layout");
  await mkdir(output, { recursive: true });
  const server = await createServer({ configFile: false, root: desktop, cacheDir: join(output, "vite-cache"), plugins: [tailwindcss()],
    optimizeDeps: { entries: ["test/fixtures/subtitle-preview.html"] },
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": join(desktop, "src/renderer") } },
    server: { host: "127.0.0.1", port: 0 } });
  let app;
  const report = { consoleErrors: [], failedRequests: [], screenshots: [], geometry: [] };
  try {
    await server.listen();
    const fixtureUrl = `${server.resolvedUrls.local[0]}test/fixtures/subtitle-preview.html`;
    app = await chromium.launch({ executablePath: process.env.SUBTITLE_PREVIEW_BROWSER_EXECUTABLE,
      args: ["--disable-gpu", "--no-sandbox"], headless: true, timeout: 20000 });
    const page = await app.newPage({ viewport: { width: 1100, height: 1100 } });
    page.on("pageerror", (error) => report.consoleErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    page.on("requestfailed", (request) => report.failedRequests.push(request.url()));
    await page.goto(fixtureUrl);
    const settings = page.getByTestId("settings");
    const span = settings.getByLabel("Subtitle preview").locator("span");
    await span.waitFor();
    const waitMeasured = async () => {
      await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('[data-testid="settings"] [aria-label="Subtitle preview"] span')).fontSize) > 0);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    };
    await waitMeasured();
    await t.test("portrait frame keeps selected ratio within both available bounds", async () => {
      for (const narrow of [false, true]) {
        if (narrow) await page.getByRole("button", { name: "Resize preview", exact: true }).click();
        for (const [ratio, expected] of [["9:16", 9/16], ["16:9", 16/9], ["1:1", 1], ["4:3", 4/3]]) {
          await page.getByRole("combobox", { name: "Frame ratio", exact: true }).selectOption(ratio);
          await waitMeasured();
          const frame = await page.locator(".nx-editor-preview-frame").evaluate((element) => {
            const rect = element.getBoundingClientRect(); const bounds = element.parentElement.getBoundingClientRect();
            return { width: rect.width, height: rect.height, boundsWidth: bounds.width, boundsHeight: bounds.height };
          });
          report.geometry.push({ ratio, narrow, ...frame });
          assert.ok(Math.abs(frame.width / frame.height - expected) < 0.002, JSON.stringify({ ratio, ...frame }));
          assert.ok(frame.width <= frame.boundsWidth && frame.height <= frame.boundsHeight);
        }
      }
      await page.getByRole("button", { name: "Toggle loading" }).click();
      await page.getByText("Đang tải preview…", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Toggle loading" }).click();
      await page.getByRole("button", { name: "Toggle error" }).click();
      await page.getByText("Fixture media unavailable", { exact: true }).waitFor();
      await page.getByRole("combobox", { name: "Frame ratio", exact: true }).selectOption("9:16"); await waitMeasured();
      const screenshot = join(output, "bounded-editor-portrait.png"); await page.getByTestId("editor").screenshot({ path: screenshot }); report.screenshots.push(screenshot);
    });
    await t.test("720p portrait uses 1280px output height for minimum font and margins", async () => {
      await page.getByRole("combobox", { name: "Frame ratio", exact: true }).selectOption("9:16");
      await waitMeasured();
      const actual = await span.evaluate((element) => {
        const overlay = element.closest('[aria-label="Subtitle preview"]');
        return { height: overlay.clientHeight, font: parseFloat(getComputedStyle(element).fontSize),
          left: parseFloat(getComputedStyle(element.parentElement).left), bottom: parseFloat(getComputedStyle(element.parentElement).bottom) };
      });
      assert.ok(Math.abs(actual.font / actual.height - 26/1280) < 0.0001, JSON.stringify(actual));
      assert.ok(Math.abs(actual.left / actual.height - 14/1280) < 0.0001, JSON.stringify(actual));
      assert.ok(Math.abs(actual.bottom / actual.height - 26/1280) < 0.0001, JSON.stringify(actual));
      report.minimumSubtitleGeometry = actual;
      const screenshot = join(output, "portrait-minimum-geometry.png"); await settings.getByLabel("Subtitle preview").screenshot({ path: screenshot }); report.screenshots.push(screenshot);
    });
    await t.test("transparent DEFAULT background leaves no opaque red shadow pixels", async () => {
      const setInput = async (label, value) => settings.getByLabel(label, { exact: true }).evaluate((input, selected) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, selected);
        input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
      await setInput("Màu nền", "#ff0000"); await setInput("Độ đậm nền", "0"); await waitMeasured();
      const preview = settings.getByLabel("Subtitle preview");
      report.transparentStyle = await span.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, shadow: getComputedStyle(element).textShadow }));
      const transparent = PNG.sync.read(await preview.screenshot({ path: join(output, "transparent-red-background.png") }));
      const redPixels = (png) => { let count = 0; for (let i = 0; i < png.data.length; i += 4)
        if (png.data[i] > 100 && png.data[i] > png.data[i+1] * 1.5 && png.data[i] > png.data[i+2] * 1.5) count++; return count; };
      // Chromium uses colored subpixel antialiasing for white glyphs. Compare
      // the complete pixels to an equally transparent black background.
      await setInput("Màu nền", "#000000"); await waitMeasured();
      const transparentBlack = PNG.sync.read(await preview.screenshot());
      assert.ok(transparent.data.equals(transparentBlack.data), "Opacity zero must hide the selected background and shadow color");
      await setInput("Màu nền", "#ff0000"); await setInput("Độ đậm nền", "100"); await waitMeasured();
      assert.ok(redPixels(PNG.sync.read(await preview.screenshot())) > 100, "Opacity one must show the selected red background");
      const screenshot = join(output, "opaque-red-background.png"); await preview.screenshot({ path: screenshot }); report.screenshots.push(screenshot);
    });
    assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.failedRequests, []);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
    await app?.close(); await server.close();
  }
});
