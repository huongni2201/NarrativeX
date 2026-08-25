import test from "node:test";
import assert from "node:assert/strict";
import {
  configureAuthenticatedActionGate,
} from "../src/renderer/features/auth/authenticated-action.ts";
import {
  commitCommand,
  createCommandHistory,
  redoCommand,
  undoCommand,
} from "../src/renderer/features/production/command-history.ts";

test("signed-in command history supports undo, redo, and clears redo after a new command", () => {
  const cleanup = configureAuthenticatedActionGate({
    signedIn: true,
    onAuthenticationRequired: () => assert.fail("signed-in command requested authentication"),
  });
  try {
    let history = createCommandHistory({ value: 0 });
    history = commitCommand(history, { value: 1 });
    history = commitCommand(history, { value: 2 });
    history = undoCommand(history);
    assert.deepEqual(history.present, { value: 1 });
    history = redoCommand(history);
    assert.deepEqual(history.present, { value: 2 });
    history = undoCommand(history);
    history = commitCommand(history, { value: 3 });
    assert.equal(history.future.length, 0);
    assert.deepEqual(history.present, { value: 3 });
  } finally {
    cleanup();
  }
});

test("guest timeline commands request authentication without mutating history", () => {
  const reasons = [];
  const cleanup = configureAuthenticatedActionGate({
    signedIn: false,
    onAuthenticationRequired: (reason) => reasons.push(reason),
  });
  try {
    const history = {
      present: { value: 1 },
      past: [{ value: 0 }],
      future: [{ value: 2 }],
    };

    assert.equal(commitCommand(history, { value: 3 }), history);
    assert.equal(undoCommand(history), history);
    assert.equal(redoCommand(history), history);
    assert.equal(reasons.length, 3);
    assert.ok(reasons.every((reason) => reason.includes("Đăng nhập để chỉnh sửa video")));
  } finally {
    cleanup();
  }
});
