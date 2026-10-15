import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import * as cache from "../src/renderer/features/production/subtitle-settings-cache.ts";

test("a settings GET started before save cannot overwrite the saved response", async () => {
  assert.equal(typeof cache.cacheSavedSubtitleSettings, "function");
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const key = ["project-subtitle-settings", "project-one"];
  const old = {enabled:true, style:{position:"BOTTOM_CENTER"}};
  const saved = {enabled:true, style:{position:"TOP_LEFT"}};
  client.setQueryData(key, old);
  let resolveOld, started;
  const began = new Promise((resolve) => { started = resolve; });
  const pending = client.fetchQuery({queryKey:key, queryFn: () => {
    started(); return new Promise((resolve) => { resolveOld = resolve; });
  }}).catch(() => undefined);
  await began;
  await cache.cacheSavedSubtitleSettings(client, "project-one", saved);
  resolveOld(old); await pending;
  assert.deepEqual(client.getQueryData(key), saved);
  assert.equal(client.getQueryData(["project-subtitle-settings", "project-two"]), undefined);
  client.clear();
});
