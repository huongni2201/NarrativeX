import test from "node:test";
import assert from "node:assert/strict";
import { RenderDeliveryTaskStore } from "../src/main/rendering/render-delivery-task-store.ts";

test("failed artifact delivery remains retryable without reauthorizing destination", () => {
  const store = new RenderDeliveryTaskStore();
  store.bind({
    projectId: "project-1",
    jobId: "job-1",
    senderId: 7,
    directory: "/exports",
  });

  const first = store.begin("project-1", "job-1", 7);
  assert.equal(first.state, "DELIVERING");
  store.fail("project-1", "job-1", 7, new Error("disk temporarily unavailable"));

  const retry = store.begin("project-1", "job-1", 7);
  assert.equal(retry.directory, "/exports");
  assert.equal(retry.state, "DELIVERING");

  store.complete("project-1", "job-1", 7, "/exports/final.mp4");
  const delivered = store.find("project-1", "job-1", 7);
  assert.equal(delivered?.state, "DELIVERED");
  assert.equal(delivered?.finalPath, "/exports/final.mp4");
});

test("delivery store prevents concurrent copies and cross-window reuse", () => {
  const store = new RenderDeliveryTaskStore();
  store.bind({
    projectId: "project-1",
    jobId: "job-1",
    senderId: 7,
    directory: "/exports",
  });
  store.begin("project-1", "job-1", 7);

  assert.throws(
    () => store.begin("project-1", "job-1", 7),
    /already in progress/,
  );
  assert.throws(
    () => store.find("project-1", "job-1", 8),
    /another window/,
  );
});
