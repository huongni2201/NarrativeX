import test from "node:test";
import assert from "node:assert/strict";
import { commitCommand, createCommandHistory, redoCommand, undoCommand } from "../src/renderer/features/production/command-history.ts";

test("command history supports undo, redo, and clears redo after a new command", () => {
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
});
