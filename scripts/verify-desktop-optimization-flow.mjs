// Run with the available Playwright browser_run_code_unsafe tool using this file
// as filename. The tool supplies a real Playwright Page; no mock bridge is added.
// Navigate it to the production Electron renderer before a production run.
// This checks renderer navigation only, not native rendering or process startup.
async (page) => {
  const report = {
    status: "BLOCKED",
    performanceDecision: "DEFER",
    startup: "UNMEASURED: requires five cold and five warm production process launches",
    nativeRender: "UNVERIFIED: playback/export and journal recovery require native acceptance",
    routes: [],
    consoleErrors: [],
    failedRequests: [],
    failedResponses: [],
    screenshots: [],
  };
  const onConsole = (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  };
  const onError = (error) => report.consoleErrors.push(error.message);
  const onFailure = (request) => report.failedRequests.push({
    url: request.url().split("?")[0],
    reason: request.failure()?.errorText,
  });
  const onResponse = (response) => {
    if (response.status() >= 400) report.failedResponses.push({
      url: response.url().split("?")[0],
      status: response.status(),
    });
  };
  page.on("console", onConsole);
  page.on("pageerror", onError);
  page.on("requestfailed", onFailure);
  page.on("response", onResponse);

  const capture = async (name) => {
    const path = `.tmp/desktop-optimization-${name}.png`;
    await page.screenshot({ path, fullPage: true });
    report.screenshots.push(path);
  };
  try {
    const initialUrl = page.url() === "about:blank" ? "http://localhost:5173/" : page.url();
    const baseUrl = initialUrl.split("#")[0];
    await page.goto(`${baseUrl}#/projects`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const environment = await page.evaluate(() => ({
      bridge: Boolean(window.narrativex?.localProjects && window.narrativex?.api),
      development: Boolean(document.querySelector('script[src*="/@vite/client"]')),
    }));
    report.environment = environment;
    if (!environment.bridge) {
      report.reason = "The real Electron preload bridge is absent; browser-only flow cannot read the local project catalog.";
      await page.getByText("Không thể tải projects", { exact: true }).waitFor({ timeout: 15_000 });
      await capture("bridge-blocked");
      await page.getByRole("button", { name: "Thử lại", exact: true }).click();
      await page.getByText("Không thể tải projects", { exact: true }).waitFor({ timeout: 15_000 });
      report.bridgeRetry = "The real Projects retry ran and returned the missing-bridge error.";
      return report;
    }
    await page.getByRole("button", { name: "New project", exact: true }).waitFor({ timeout: 30_000 });
    await capture("projects");
    // Local catalog reads are real, read-only IPC. Do not create a fake project.
    const entries = await page.evaluate(() => window.narrativex.localProjects.list());
    const project = entries.find((entry) => entry.project)?.project;
    if (!project) {
      report.reason = "Projects is usable, but no registered local project is available for the workspace flow.";
      return report;
    }
    const root = `/projects/${encodeURIComponent(project.id)}`;
    const visit = async (name, path, ready, cold = false) => {
      const start = Date.now();
      if (cold) {
        await page.goto(`${baseUrl}#${root}/${path}`, { waitUntil: "domcontentloaded" });
        await page.reload({ waitUntil: "domcontentloaded" });
      } else {
        await page.evaluate((hash) => { location.hash = hash; }, `${root}/${path}`);
      }
      await ready.waitFor({ timeout: 30_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      report.routes.push({ name, ms: Date.now() - start, coldDocument: cold, overflow });
      await capture(name);
    };
    await visit("chapters", "chapters", page.getByRole("button", { name: "Source (Văn bản)", exact: true }));
    const production = page.getByRole("button", { name: /Production|Sản xuất/ }).first();
    await production.click();
    await capture("production");
    await visit("editor-first", "editor", page.getByRole("button", { name: "Render", exact: true }));
    await visit("render-direct", "render", page.getByRole("heading", { name: "Auto Edit & Render", exact: true }), true);
    await visit("canon-cold", "canon", page.getByRole("button", { name: /Giọng đọc \(Voices\)/ }), true);
    await page.getByRole("button", { name: /Giọng đọc \(Voices\)/ }).click();
    await capture("voices");
    await visit("editor-revisit", "editor", page.getByRole("button", { name: "Render", exact: true }));
    report.status = report.consoleErrors.length || report.failedRequests.length || report.failedResponses.length || report.routes.some((route) => route.overflow) ? "FAILED" : "PARTIAL";
    report.reason = "Route screenshots captured; delayed/failed module retry and native render/restart still require dedicated acceptance. Route times are diagnostic, not process startup measurements.";
    return report;
  } catch (error) {
    report.status = "FAILED";
    report.reason = error.message;
    try { await capture("failure"); } catch { /* Keep the original failure. */ }
    return report;
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onError);
    page.off("requestfailed", onFailure);
    page.off("response", onResponse);
  }
}
