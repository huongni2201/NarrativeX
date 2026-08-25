import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

// Vite 7 must stay on the plugin-react 5.x compatibility line; plugin-react 6 targets Vite 8.
assert.match(pkg.dependencies["@vitejs/plugin-react"], /^\^5\./);
assert.match(pkg.dependencies["electron-vite"], /^\^5\./);
assert.match(pkg.devDependencies.typescript, /^\^7\./);

console.log("Desktop upgrade compatibility baseline is valid.");
