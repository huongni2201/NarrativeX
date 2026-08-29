import test from "node:test";
import assert from "node:assert/strict";
import { SelectionTokenStore } from "../src/main/security/selection-token-store.ts";

test("selection tokens are sender-bound, operation-bound, expiring and single-use", () => {
  const store = new SelectionTokenStore();
  const token = store.create(10, "asset-import", { sourcePath: "C:/private/input.png" }, 1_000);
  assert.deepEqual(store.consume(token, 10, "asset-import"), { sourcePath: "C:/private/input.png" });
  assert.throws(() => store.consume(token, 10, "asset-import"), /expired/i);

  const otherWindowToken = store.create(10, "asset-import", { sourcePath: "C:/private/input.png" });
  assert.throws(() => store.consume(otherWindowToken, 11, "asset-import"), /another window/i);

  const otherOperationToken = store.create(10, "asset-import", { sourcePath: "C:/private/input.png" });
  assert.throws(() => store.consume(otherOperationToken, 10, "archive"), /operation/i);
});

test("peeking selection metadata does not consume a valid token", () => {
  const store = new SelectionTokenStore();
  const token = store.create(10, "gemini-image-import", { lane: "CHARACTER" });
  assert.deepEqual(store.peek(token, 10, "gemini-image-import"), { lane: "CHARACTER" });
  assert.deepEqual(store.consume(token, 10, "gemini-image-import"), { lane: "CHARACTER" });
});
