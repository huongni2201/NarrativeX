import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  decodeStoredIdentity,
  encodeStoredIdentity,
} from "../src/main/local-execution/device-identity-format.ts";

const legacyOwnershipKey = ["user", "Id"].join("");

test("legacy device identity keeps device credentials without requiring ownership", () => {
  const encrypted = "encrypted-token";
  const identity = decodeStoredIdentity(
    {
      deviceId: "device-1",
      [legacyOwnershipKey]: "legacy-value",
      encryptedDeviceToken: encrypted,
    },
    (value) => {
      assert.equal(value, encrypted);
      return "device-token";
    },
  );

  assert.deepEqual(identity, { deviceId: "device-1", deviceToken: "device-token" });
});

test("device identity persistence format contains only executor fields", () => {
  const encoded = encodeStoredIdentity(
    { deviceId: "device-1", deviceToken: "device-token" },
    (value) => {
      assert.equal(value, "device-token");
      return "encrypted-token";
    },
  );

  assert.deepEqual(encoded, {
    schemaVersion: 2,
    deviceId: "device-1",
    encryptedDeviceToken: "encrypted-token",
  });
  assert.equal(Object.keys(encoded).some((key) => key.toLowerCase().includes("user")), false);
});

test("pair response contract contains only device credentials", async () => {
  const source = await readFile(new URL("../src/main/local-execution/backend-client.ts", import.meta.url), "utf8");
  assert.match(source, /export interface PairDeviceResponse/);
  assert.match(source, /deviceId: string/);
  assert.match(source, /deviceToken: string/);
  assert.doesNotMatch(source, /userId/);
});
