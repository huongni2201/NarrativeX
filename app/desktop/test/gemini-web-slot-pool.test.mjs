import test from "node:test";
import assert from "node:assert/strict";
import { GeminiWebSlotPool } from "../src/main/gemini-web/gemini-web-slot-pool.ts";

test("Gemini slot pool grants up to capacity and reuses a released slot", async () => {
  const pool = new GeminiWebSlotPool(2, (index) => ({ index }));
  const first = await pool.acquire();
  const second = await pool.acquire();
  let thirdResolved = false;
  const thirdPromise = pool.acquire().then((lease) => {
    thirdResolved = true;
    return lease;
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(thirdResolved, false);
  assert.notEqual(first.index, second.index);

  first.release();
  const third = await thirdPromise;
  assert.equal(third.index, first.index);
  third.release();
  second.release();
});

test("Gemini slot pool release is idempotent", async () => {
  const pool = new GeminiWebSlotPool(1, (index) => ({ index }));
  const first = await pool.acquire();
  first.release();
  first.release();
  const second = await pool.acquire();
  assert.equal(second.index, 0);
  second.release();
});

test("Gemini slot pool validates capacity", () => {
  assert.throws(() => new GeminiWebSlotPool(0, () => ({})), /capacity/i);
  assert.throws(() => new GeminiWebSlotPool(9, () => ({})), /capacity/i);
});
