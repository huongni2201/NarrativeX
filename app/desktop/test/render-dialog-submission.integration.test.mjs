import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

test("real render dialog creates deliberate exports and recovers ambiguous requests", { skip: !process.env.RENDER_DIALOG_BROWSER_TEST }, async (t) => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const { createServer } = await import("vite");
  const { default: tailwindcss } = await import("@tailwindcss/vite");
  const desktop = resolve(import.meta.dirname, "..");
  const output = resolve(desktop, "../../.tmp/render-dialog-submission");
  await mkdir(output, { recursive: true });
  // Optional sensitivity checks mutate only Vite's in-memory test module.
  const sensitivity = { name: "render-regression-sensitivity", enforce: "pre", transform(code, id) {
    if (process.env.RENDER_DIALOG_REGRESSION_MUTATION === "completed" && id.endsWith("/useRenderController.ts")) {
      const staleJob = code.replace(/    if \(liveJob\?\.status === "COMPLETED"\) \{\s*setJob\(null\);\s*setDestinationBoundJobId\(null\);\s*deliveringJobRef\.current = null;\s*(?:recoveredSubmissionRef\.current = false;\s*)?\}/, "");
      assert.notEqual(staleJob, code, "Completed sensitivity mutation did not match the completed-job reset");
      const prematureDelivery = staleJob.replace(" && !destination && !destinationToken", " && !destination");
      assert.notEqual(prematureDelivery, staleJob, "Completed sensitivity mutation did not match the destination-token guard");
      return prematureDelivery;
    }
    if (process.env.RENDER_DIALOG_REGRESSION_MUTATION === "ambiguous" && id.endsWith("/render-submission-intents.ts")) {
      return code.replace("const pending = this.read(selected.projectId);", "const pending = null;");
    }
  } };
  const server = await createServer({ configFile: false, root: desktop, cacheDir: join(output, "vite-cache"), plugins: [sensitivity, tailwindcss()],
    optimizeDeps: { entries: ["test/fixtures/render-dialog-submission.html"] }, esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": join(desktop, "src/renderer") } }, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  const report = { consoleErrors: [], failedRequests: [], scenarios: [] };
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.SUBTITLE_PREVIEW_BROWSER_EXECUTABLE,
      args: ["--disable-gpu", "--no-sandbox"], headless: true, timeout: 20000 });
    const fixtureUrl = `${server.resolvedUrls.local[0]}test/fixtures/render-dialog-submission.html`;
    const open = async (mode) => {
      const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
      const page = await context.newPage();
      page.on("pageerror", (error) => report.consoleErrors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
      page.on("requestfailed", (request) => report.failedRequests.push(request.url()));
      await page.goto(`${fixtureUrl}?mode=${mode}`);
      await page.getByText("Đã lưu theo Project", { exact: true }).waitFor();
      return page;
    };
    const snapshot = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.renderDialogFixture)));
    const color = (page, value) => page.getByLabel("Màu chữ", { exact: true }).evaluate((input, selected) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, selected);
      input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    const choose = async (page, number) => {
      await page.getByRole("button", { name: /^(Choose folder|Change)$/ }).click();
      await page.getByText(`D:/fixture/export-${number}`, { exact: true }).waitFor();
    };
    const renderAndDelivered = async (page, deliveries) => {
      await page.getByRole("button", { name: "Render video", exact: true }).click();
      await page.waitForFunction((count) => window.renderDialogFixture.deliveries.length === count, deliveries, { timeout: 5000 });
      const state = await snapshot(page); const delivery = state.deliveries.at(-1);
      await page.getByText(delivery.path, { exact: true }).waitFor();
      await page.getByText("COMPLETED", { exact: true }).waitFor();
      return state;
    };
    await t.test("choosing a new folder after completion renders the changed style as a new delivered job", async () => {
      const page = await open("normal");
      await choose(page, 1); const first = await renderAndDelivered(page, 1);
      await color(page, "#ffcc00"); await choose(page, 2);
      const second = await renderAndDelivered(page, 2);
      assert.equal(second.requests.length, 2); assert.equal(Object.keys(second.accepted).length, 2);
      assert.notEqual(second.requests[0].key, second.requests[1].key);
      assert.notEqual(second.deliveries[0].jobId, second.deliveries[1].jobId);
      assert.equal(JSON.parse(second.requests[0].body).subtitleStyle.primaryColor, "#FFFFFF");
      assert.equal(JSON.parse(second.requests[1].body).subtitleStyle.primaryColor, "#FFCC00");
      assert.equal(second.deliveries[1].path, `D:/fixture/export-2/${second.requests[1].jobId}.mp4`);
      assert.deepEqual(second.boundaryErrors, []);
      await page.screenshot({ path: join(output, "second-deliberate-render.png") });
      report.scenarios.push({ mode: "normal", first, second });
    });
    await t.test("accepted response loss survives reload and changed UI, then the next deliberate export uses the new style", async () => {
      const page = await open("ambiguous");
      await choose(page, 1);
      await page.getByRole("button", { name: "Render video", exact: true }).click();
      await page.getByText("Fixture response lost after server accepted render", { exact: true }).waitFor();
      const lost = await snapshot(page);
      assert.equal(lost.requests.length, 1); assert.equal(lost.deliveries.length, 0);
      await page.reload(); await page.getByText("Đã lưu theo Project", { exact: true }).waitFor();
      await color(page, "#00ff00"); await choose(page, 2);
      const recovered = await renderAndDelivered(page, 1);
      assert.equal(recovered.requests.length, 2); assert.equal(Object.keys(recovered.accepted).length, 1);
      assert.equal(recovered.requests[0].key, recovered.requests[1].key);
      assert.equal(recovered.requests[0].body, recovered.requests[1].body);
      assert.equal(recovered.deliveries[0].jobId, lost.requests[0].jobId);
      await choose(page, 3); const deliberate = await renderAndDelivered(page, 2);
      assert.equal(deliberate.requests.length, 3); assert.equal(Object.keys(deliberate.accepted).length, 2);
      assert.notEqual(deliberate.requests[1].key, deliberate.requests[2].key);
      assert.notEqual(deliberate.deliveries[0].jobId, deliberate.deliveries[1].jobId);
      assert.equal(JSON.parse(deliberate.requests[2].body).subtitleStyle.primaryColor, "#00FF00");
      assert.equal(deliberate.deliveries[1].path, `D:/fixture/export-3/${deliberate.requests[2].jobId}.mp4`);
      assert.deepEqual(deliberate.boundaryErrors, []);
      await page.screenshot({ path: join(output, "recovered-then-deliberate-render.png") });
      report.scenarios.push({ mode: "ambiguous", lost, recovered, deliberate });
    });
    await t.test("pending artifact delivery disables destination changes until completion and allows the next deliberate export", async () => {
      const page = await open("deferred");
      await choose(page, 1);
      await page.getByRole("button", { name: "Render video", exact: true }).click();
      await page.waitForFunction(() => window.renderDialogFixture.deliveryStarted.length === 1);
      await page.getByText("COMPLETED", { exact: true }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Change" && button.disabled), undefined, { timeout: 5000 });
      assert.equal(await page.getByRole("button", { name: "Change", exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole("button", { name: "Preparing…", exact: true }).isDisabled(), true);
      const pending = await snapshot(page);
      assert.equal(pending.deliveries.length, 0); assert.equal(pending.requests.length, 1); assert.equal(pending.folders, 1);
      await page.screenshot({ path: join(output, "pending-artifact-delivery.png") });
      await page.evaluate(() => window.releaseRenderDialogDelivery());
      await page.waitForFunction(() => window.renderDialogFixture.deliveries.length === 1);
      const first = await snapshot(page);
      await page.getByText(first.deliveries[0].path, { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Choose folder", exact: true }).isEnabled(), true);
      await color(page, "#ffcc00"); await choose(page, 2);
      const second = await renderAndDelivered(page, 2);
      assert.equal(second.requests.length, 2); assert.equal(second.deliveryStarted.length, 2);
      assert.notEqual(second.requests[0].key, second.requests[1].key);
      assert.notEqual(second.deliveries[0].jobId, second.deliveries[1].jobId);
      assert.equal(second.deliveries[1].path, `D:/fixture/export-2/${second.requests[1].jobId}.mp4`);
      assert.equal(JSON.parse(second.requests[1].body).subtitleStyle.primaryColor, "#FFCC00");
      assert.deepEqual(second.boundaryErrors, []);
      report.scenarios.push({ mode: "deferred", pending, first, second });
    });
    await t.test("long delivered Windows paths preserve dialog controls without horizontal overflow", async () => {
      const page = await open("longpath");
      await choose(page, 1); const delivered = await renderAndDelivered(page, 1);
      const layouts = [];
      for (const viewport of [{ width: 1024, height: 768 }, { width: 2560, height: 1353 }]) {
        await page.setViewportSize(viewport);
        const dialog = page.getByRole("dialog");
        await dialog.getByText("Render final video", { exact: true }).waitFor();
        const measured = await dialog.evaluate((element) => {
          const body = [...element.children].find((child) => getComputedStyle(child).overflowY === "auto");
          const bounds = body.getBoundingClientRect();
          const controls = [...body.querySelectorAll("button,input")].map((control) => {
            const rect = control.getBoundingClientRect();
            return { name: control.getAttribute("aria-label") || control.textContent.trim(), left: rect.left, right: rect.right };
          });
          return { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, left: bounds.left, right: bounds.right, controls };
        });
        layouts.push({ ...viewport, ...measured });
        assert.ok(measured.scrollWidth <= measured.clientWidth, JSON.stringify(measured));
        for (const control of measured.controls) {
          assert.ok(control.left >= measured.left && control.right <= measured.right, `Clipped control: ${JSON.stringify(control)}`);
        }
        await page.getByRole("button", { name: "Choose folder", exact: true }).scrollIntoViewIfNeeded();
        assert.equal(await page.getByRole("button", { name: "Choose folder", exact: true }).isVisible(), true);
        await page.screenshot({ path: join(output, `long-path-dialog-${viewport.width}.png`) });
      }
      assert.deepEqual(delivered.boundaryErrors, []);
      report.scenarios.push({ mode: "longpath", delivered, layouts });
    });
    assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.failedRequests, []);
  } finally {
    await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
  }
});
