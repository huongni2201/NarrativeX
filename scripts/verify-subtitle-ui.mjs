// Real Electron + backend verification. Use a disposable backend and isolated
// TEMP directory; never inject a fake bridge or provider into the application.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const backend = process.env.SUBTITLE_TEST_BACKEND_URL;
assert.equal(backend, "http://127.0.0.1:58080", "Only the isolated subtitle test backend is permitted.");
const root = resolve(import.meta.dirname, "..");
const output = join(root, ".tmp", "subtitle-ui");
const temporary = join(output, "electron-temp");
await mkdir(temporary, { recursive: true });
const env = { ...process.env, TEMP: temporary, TMP: temporary, NARRATIVEX_BACKEND_URL: backend };
delete env.ELECTRON_RUN_AS_NODE;
const report = { status: "RUNNING", nativeFlags: ["--disable-gpu", "--no-sandbox"], consoleErrors: [], failedRequests: [], screenshots: [] };
const app = await _electron.launch({ executablePath: join(root, "app/desktop/node_modules/electron/dist/electron.exe"),
  args: [join(root, "app/desktop"), ...report.nativeFlags], env, timeout: 20_000 });
try {
  const page = await app.firstWindow({timeout: 20_000});
  page.on("pageerror", (error) => report.consoleErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  await app.evaluate(({session}, backendUrl) => {
    globalThis.subtitleRequests = [];
    session.defaultSession.webRequest.onCompleted({urls: [`${backendUrl}/api/v1/*`]}, (event) => {
      globalThis.subtitleRequests.push({url: event.url, status: event.statusCode});
    });
    session.defaultSession.webRequest.onErrorOccurred({urls: [`${backendUrl}/api/v1/*`]}, (event) => {
      globalThis.subtitleRequests.push({url: event.url, error: event.error});
    });
  }, backend);
  await page.getByRole("button", {name: "New project", exact: true}).waitFor({timeout: 20_000});
  const projects = await page.evaluate(async () => {
    const result = [];
    for (let index = 0; index < 2; index++) {
      const response = await window.narrativex.api.request({path: "/api/v1/projects", method: "POST",
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({name: `Subtitle verification ${index + 1}`,
          sourceLanguage: "vi", narrationLanguage: "vi", metadataLanguage: "vi", imageAspectRatio: index ? "9:16" : "16:9"})});
      if (response.status !== 201) throw new Error(`Project creation failed: ${response.status} ${response.bodyText}`);
      const project = JSON.parse(response.bodyText).data;
      await window.narrativex.localProjects.upsert(project);
      if (index === 1) {
        const chapter = await window.narrativex.api.request({path: `/api/v1/projects/${project.id}/chapters`, method:"POST",
          headers:{"Content-Type":"application/json", "Idempotency-Key":crypto.randomUUID()},
          body:JSON.stringify({title:"Subtitle portrait geometry", sourceText:"Xin chào"})});
        if (chapter.status !== 201) throw new Error(`Portrait chapter creation failed: ${chapter.status}`);
      }
      result.push(project);
    }
    return result;
  });
  const visit = async (project, screen) => {
    await page.evaluate((hash) => { location.hash = hash; }, `/projects/${project.id}/${screen}`);
    await page.getByRole("button", {name: "Lưu tùy chỉnh", exact: true}).waitFor();
    await page.getByText("Đã lưu theo Project", {exact: true}).waitFor({timeout: 20_000});
  };
  const screenshot = async (name) => {
    const path = join(output, `${name}.png`);
    await page.screenshot({path, fullPage: true}); report.screenshots.push(path);
  };
  await page.evaluate((hash) => { location.hash = hash; }, `/projects/${projects[0].id}/chapters`);
  const createChapter = page.getByRole("button", {name: "Tạo chapter", exact: true});
  await createChapter.waitFor();
  assert.equal(await createChapter.isDisabled(), true);
  await page.getByLabel("Văn bản nguồn chương", {exact: true}).fill("   ");
  assert.equal(await createChapter.isDisabled(), true);
  await page.getByLabel("Tiêu đề chương", {exact: true}).fill("Chapter review flow");
  await page.getByLabel("Văn bản nguồn chương", {exact: true}).fill("Xin chào từ chapter đầu tiên.");
  await screenshot("chapter-initial-form");
  await createChapter.click();
  await page.getByRole("button", {name: "Analyze Chapter", exact: true}).waitFor();
  assert.equal(await page.getByPlaceholder("Ví dụ: Chương 1 - Lời sấm truyền khởi đầu...").inputValue(), "Chapter review flow");
  assert.equal(await page.getByPlaceholder("Dán hoặc soạn thảo nội dung văn bản kịch bản/tiểu thuyết của chương vào đây...").inputValue(), "Xin chào từ chapter đầu tiên.");
  await screenshot("chapter-created");
  report.initialChapter = "Real source form rejected empty/whitespace input and persisted the entered title and text.";
  const setInput = async (label, value) => page.getByLabel(label, {exact:true}).evaluate((input, selected) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, selected);
    input.dispatchEvent(new Event("input", {bubbles:true}));
    input.dispatchEvent(new Event("change", {bubbles:true}));
  }, value);
  const settings = async (project) => page.evaluate(async (id) => {
    const response = await window.narrativex.api.request({path:`/api/v1/projects/${id}/production/subtitle-settings`});
    if (response.status !== 200) throw new Error(`Settings GET failed: ${response.status}`);
    return JSON.parse(response.bodyText).data;
  }, project.id);
  await visit(projects[0], "render");
  for (const label of ["Trên trái", "Trên giữa", "Trên phải", "Giữa trái", "Chính giữa", "Giữa phải", "Dưới trái", "Dưới giữa", "Dưới phải"]) {
    await page.getByRole("button", {name:label, exact:true}).click();
    assert.equal(await page.getByRole("button", {name:label, exact:true}).getAttribute("aria-pressed"), "true");
  }
  await page.getByRole("button", {name:"Trên trái", exact:true}).click();
  await page.getByRole("combobox", {name:"Font chữ", exact:true}).click();
  await page.getByRole("option", {name:"Verdana · Tiếng Việt", exact:true}).click();
  for (const label of ["Chữ có viền", "Chữ có bóng", "Nền mờ", "Mặc định"]) {
    await page.getByRole("combobox", {name:"Mẫu hiển thị", exact:true}).click();
    await page.getByRole("option", {name:label, exact:true}).click();
  }
  await page.getByRole("combobox", {name:"Mẫu hiển thị", exact:true}).click();
  await page.getByRole("option", {name:"Nền mờ", exact:true}).click();
  await setInput("Cỡ chữ", "6"); await setInput("Khoảng cách mép", "10");
  await setInput("Màu chữ", "#ffcc00"); await setInput("Độ đậm nền", "40");
  await page.getByRole("checkbox", {name:"Chữ đậm", exact:true}).uncheck();
  await page.getByRole("button", {name:"Lưu tùy chỉnh", exact:true}).click();
  await page.getByText("Đã lưu theo Project", {exact:true}).waitFor();
  const saved = await settings(projects[0]);
  assert.equal(saved.style.position, "TOP_LEFT"); assert.equal(saved.style.fontFamily, "Verdana");
  assert.equal(saved.style.preset, "BACKGROUND"); assert.equal(saved.style.fontSizeRatio, 0.06);
  assert.equal(saved.style.edgeMarginRatio, 0.1); assert.equal(saved.style.primaryColor, "#FFCC00");
  assert.equal(saved.style.backgroundOpacity, 0.4); assert.equal(saved.style.fontWeight, 400);
  const preview = page.getByLabel("Subtitle preview").locator("span");
  const computed = await preview.evaluate((span) => ({font: getComputedStyle(span).fontFamily, color: getComputedStyle(span).color}));
  assert.equal(computed.font, "Verdana"); assert.equal(computed.color, "rgb(255, 204, 0)");
  await screenshot("render-custom");
  await page.reload(); await page.getByText("Đã lưu theo Project", {exact:true}).waitFor();
  assert.equal(await page.getByRole("button", {name:"Trên trái", exact:true}).getAttribute("aria-pressed"), "true");
  await visit(projects[1], "render");
  assert.equal(await page.getByRole("button", {name:"Dưới giữa", exact:true}).getAttribute("aria-pressed"), "true");
  await screenshot("portrait-default");
  const portraitSample = await page.getByLabel("Subtitle preview").boundingBox();
  assert.ok(Math.abs(portraitSample.width / portraitSample.height - 9/16) < 0.003, JSON.stringify(portraitSample));
  await page.evaluate((hash) => { location.hash = hash; }, `/projects/${projects[1].id}/editor`);
  await page.getByRole("button", {name:"Render", exact:true}).waitFor();
  await page.locator(".nx-editor-preview-frame").waitFor();
  const portraitFrame = await page.locator(".nx-editor-preview-frame").boundingBox();
  assert.ok(Math.abs(portraitFrame.width / portraitFrame.height - 9/16) < 0.003, JSON.stringify(portraitFrame));
  await screenshot("portrait-editor");
  await visit(projects[0], "render");
  assert.equal(await page.getByRole("button", {name:"Trên trái", exact:true}).getAttribute("aria-pressed"), "true");
  await page.evaluate((hash) => { location.hash = hash; }, `/projects/${projects[0].id}/editor`);
  await page.getByRole("button", {name:"Render", exact:true}).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.getByRole("button", {name:"Trên trái", exact:true}).getAttribute("aria-pressed"), "true");
  await screenshot("editor-render-dialog");
  await page.setViewportSize({width:1024, height:768});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await screenshot("dialog-1024");
  await page.getByRole("checkbox", {name:"Bật phụ đề", exact:true}).uncheck();
  assert.equal(await page.getByRole("button", {name:"Trên trái", exact:true}).isDisabled(), true);
  await page.getByRole("button", {name:"Lưu tùy chỉnh", exact:true}).click();
  await page.getByText("Đã lưu theo Project", {exact:true}).waitFor();
  assert.equal((await settings(projects[0])).enabled, false);
  await page.keyboard.press("Escape"); await page.getByRole("dialog").waitFor({state:"hidden"});
  await visit(projects[0], "render");
  assert.equal(await page.getByRole("checkbox", {name:"Bật phụ đề", exact:true}).isChecked(), false);
  await page.getByRole("checkbox", {name:"Bật phụ đề", exact:true}).check();
  await page.getByRole("button", {name:"Mặc định", exact:true}).click();
  assert.equal(await page.getByRole("button", {name:"Dưới giữa", exact:true}).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", {name:"Lưu tùy chỉnh", exact:true}).click();
  await page.getByText("Đã lưu theo Project", {exact:true}).waitFor();
  assert.equal((await settings(projects[0])).style.fontFamily, "Arial");
  report.requests = await app.evaluate(() => globalThis.subtitleRequests);
  // Route changes intentionally abort long-lived project SSE subscriptions.
  report.expectedSseDisconnects = report.requests.filter((entry) => entry.error === "net::ERR_ABORTED" && entry.url.endsWith("/generation/events"));
  report.failedRequests = report.requests.filter((entry) => (entry.error && !(entry.error === "net::ERR_ABORTED" && entry.url.endsWith("/generation/events"))) || entry.status >= 400);
  report.status = report.consoleErrors.length || report.failedRequests.length ? "FAILED" : "PASS";
  report.scope = "Real Electron/IPC/backend/PostgreSQL preferences flow. No production GPU or final-video job is claimed.";
  assert.equal(report.status, "PASS", JSON.stringify({console: report.consoleErrors, requests: report.failedRequests}));
} catch (error) {
  report.status = "FAILED"; report.error = error.message;
  throw error;
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await app.close();
  console.log(JSON.stringify(report));
}
