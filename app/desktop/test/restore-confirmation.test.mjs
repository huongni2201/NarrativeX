import test from "node:test";
import assert from "node:assert/strict";
import {
  REPLACE_PROJECT_DIALOG_RESPONSE,
  shouldProceedWithRestore,
} from "../src/main/local-storage/restore-confirmation.ts";

test("a new project restores without a confirmation response", () => {
  assert.equal(shouldProceedWithRestore(false, undefined), true);
});

test("canceling replacement prevents restore", () => {
  assert.equal(shouldProceedWithRestore(true, 0), false);
  assert.equal(shouldProceedWithRestore(true, undefined), false);
});

test("explicit Replace Project confirmation permits restore", () => {
  assert.equal(shouldProceedWithRestore(true, REPLACE_PROJECT_DIALOG_RESPONSE), true);
});
