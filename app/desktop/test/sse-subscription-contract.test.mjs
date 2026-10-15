import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("preload SSE subscription IDs satisfy main-process validation", () => {
  const preloadSource = readFileSync(
    new URL("../src/preload/index.ts", import.meta.url),
    "utf8",
  );
  const mainSource = readFileSync(
    new URL("../src/main/api/backend-sse-ipc.ts", import.meta.url),
    "utf8",
  );

  assert.match(preloadSource, /crypto\.randomUUID\(\)/);
  assert.match(mainSource, /const SUBSCRIPTION_ID = \/\^\[0-9a-f-\]\{36\}\$\/iu/);
});

test("project event subscription refreshes on the backend resync event", async () => {
  const { subscribeProjectEvents } = await import(
    "../src/renderer/features/generation/realtime/project-event-subscription.ts"
  );
  const invalidated = [];
  const client = { invalidateQueries: (filters) => { invalidated.push(filters); return Promise.resolve(); } };
  let emit;
  const api = {
    subscribe(_path, handlers) {
      emit = handlers.onEvent;
      return () => {};
    },
  };
  const stop = subscribeProjectEvents(client, "project-1", api, () => {});
  emit({ event: "connected", data: "{}" });
  invalidated.length = 0;

  emit({ event: "resync", data: "{\"reason\":\"listener-reconnected\"}" });

  assert.ok(invalidated.length > 0, "resync must refetch production and storyboard state");
  assert.ok(
    invalidated.some((filters) => JSON.stringify(filters.queryKey) === JSON.stringify(["storyboards", "project-1"])),
  );
  stop();
});

test("project event subscription keeps the job.updated payload contract", async () => {
  const { subscribeProjectEvents } = await import(
    "../src/renderer/features/generation/realtime/project-event-subscription.ts"
  );
  const invalidated = [];
  const client = { invalidateQueries: (filters) => { invalidated.push(filters); return Promise.resolve(); } };
  let emit;
  const api = { subscribe(_path, handlers) { emit = handlers.onEvent; return () => {}; } };
  const stop = subscribeProjectEvents(client, "project-1", api, () => {});
  emit({ event: "connected", data: "{}" });
  invalidated.length = 0;

  // Exact shape produced by GenerationEventHub for a terminal job.
  emit({
    event: "job.completed",
    data: JSON.stringify({
      jobId: "job-1", projectId: "project-1", type: "CHAPTER_ANALYZE", status: "COMPLETED",
      step: "Done", progress: 100, active: false, terminal: true, errorCode: "",
    }),
  });

  assert.ok(invalidated.some((filters) => JSON.stringify(filters.queryKey) === JSON.stringify(["generation", "generation-job", "job-1"])));
  assert.ok(invalidated.some((filters) => JSON.stringify(filters.queryKey) === JSON.stringify(["storyboards", "project-1"])));
  stop();
});
