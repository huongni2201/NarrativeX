import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
const lockedRoot = lock.packages?.[""];

assert.ok(lockedRoot, "package-lock.json is missing the root package entry");

for (const section of ["dependencies", "devDependencies"]) {
  const expected = manifest[section] ?? {};
  const actual = lockedRoot[section] ?? {};
  assert.deepEqual(
    actual,
    expected,
    `package-lock.json ${section} is out of sync with package.json; run npm install --package-lock-only`,
  );
}

console.log("package.json and package-lock.json root dependencies are synchronized.");
