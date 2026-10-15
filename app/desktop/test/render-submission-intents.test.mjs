import assert from "node:assert/strict";
import test from "node:test";
import * as implementation from "../src/renderer/features/production/render-submission-intents.ts";
import { DEFAULT_SUBTITLE_STYLE } from "../src/shared/subtitle-style.ts";

const projectId = "00000000-0000-0000-0000-000000000001";
const input = (color = "#FFFFFF") => ({projectId, resolution:"720p", fps:24, format:"mp4",
  executionTarget:"LOCAL_DEVICE", localDeviceId:"00000000-0000-0000-0000-000000000002",
  subtitlesEnabled:true, subtitleStyle:{...DEFAULT_SUBTITLE_STYLE, primaryColor:color}, beatOverrides:[]});
class BrowserStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("an ambiguous submission survives restart and replays its frozen request and key", () => {
  const storage = new BrowserStorage();
  const store = new implementation.RenderSubmissionIntents(storage);
  const selected = input();
  const first = store.prepare(selected);
  selected.subtitleStyle.primaryColor = "#FF0000";
  const resumed = new implementation.RenderSubmissionIntents(storage).prepare(input("#FF0000"));
  assert.equal(resumed.idempotencyKey, first.idempotencyKey);
  assert.equal(resumed.request.subtitleStyle.primaryColor, "#FFFFFF");
  assert.equal(resumed.recovered, true);
  assert.equal(first.recovered, false);
});

test("a confirmed response allows a new deliberate render with a new style and intent", () => {
  const store = new implementation.RenderSubmissionIntents(new BrowserStorage());
  const first = store.prepare(input());
  store.complete(projectId, first.idempotencyKey);
  const second = store.prepare(input("#FF0000"));
  assert.notEqual(second.idempotencyKey, first.idempotencyKey);
  assert.equal(second.request.subtitleStyle.primaryColor, "#FF0000");
  store.complete(projectId, first.idempotencyKey); // late response cannot clear the new intent
  assert.equal(store.prepare(input()).idempotencyKey, second.idempotencyKey);
});

test("corrupt saved intent fails closed instead of silently creating another render", () => {
  const storage = new BrowserStorage();
  const store = new implementation.RenderSubmissionIntents(storage);
  store.prepare(input());
  const key = [...storage.values.keys()][0];
  storage.setItem(key, "{broken");
  assert.throws(() => store.prepare(input()), /yêu cầu render/i);
  assert.equal(storage.getItem(key), "{broken");
});
