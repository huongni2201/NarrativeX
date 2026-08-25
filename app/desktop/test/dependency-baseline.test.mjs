import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

test("desktop dependency baseline stays on the migrated stable majors", () => {
  assert.match(pkg.dependencies.electron, /^\^43\./);
  assert.match(pkg.dependencies["electron-vite"], /^\^5\./);
  assert.match(pkg.dependencies["@vitejs/plugin-react"], /^\^5\./);
  assert.match(pkg.dependencies.react, /^\^19\.2\./);
  assert.match(pkg.dependencies["react-router-dom"], /^\^7\.18\./);
  assert.match(pkg.dependencies["lucide-react"], /^\^1\./);
  assert.match(pkg.devDependencies.typescript, /^\^7\./);
  assert.equal(pkg.devDependencies.tailwindcss, "^4.3.3");
});
