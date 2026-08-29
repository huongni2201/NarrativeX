import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const source = (...parts) => readFileSync(path.join(root, ...parts), "utf8");

test("desktop request contract uses one authenticated API base URL", () => {
  const client = source("app", "desktop", "src", "renderer", "api", "client.ts");
  assert.match(client, /credentials:\s*"include"/);
  assert.match(client, /window\.narrativex\.api\.getBaseUrl/);
  assert.doesNotMatch(client, /VITE_BACKEND_URL/);
});

test("desktop preload exposes guarded IPC APIs only", () => {
  const preload = source("app", "desktop", "src", "preload", "index.ts");
  assert.match(preload, /contextBridge\.exposeInMainWorld\("narrativex"/);
  assert.doesNotMatch(preload, /ipcRenderer:\s*ipcRenderer/);
});

test("desktop API helper owns authenticated voice upload orchestration", () => {
  const main = source("app", "desktop", "src", "main", "api", "desktop-api-client.ts");
  assert.match(main, /voice-references\/upload-intents/);
  assert.match(main, /uploadVoiceReference/);
});

test("renderer does not access R2 credentials or object storage SDKs", () => {
  const voicesApi = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "voices",
    "api",
    "voices.api.ts",
  );
  const narrationApi = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "generation",
    "api",
    "narration.api.ts",
  );
  const combined = `${voicesApi}\n${narrationApi}`;
  assert.doesNotMatch(combined, /R2_ACCESS_KEY|R2_SECRET|S3Client|boto3|storageKey/);
});

test("project media APIs register metadata instead of remote upload intents", () => {
  const assetsApi = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "assets",
    "api",
    "assets.api.ts",
  );
  assert.match(assetsApi, /registerLocal/);
  assert.doesNotMatch(assetsApi, /upload-intents/);
});

test("desktop project storage copies selected files into project-owned paths", () => {
  const storage = source("app", "desktop", "src", "main", "local-storage", "project-storage.ts");
  assert.match(storage, /commitSelectedAsset/);
  assert.match(storage, /assets\/audio/);
  assert.match(storage, /checksumSha256/);
  assert.match(storage, /project\.manifest\.json/);
});

test("generation analysis requests include a unique idempotency key", () => {
  const generation = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "generation",
    "api",
    "generation.api.ts",
  );
  assert.match(
    generation,
    /analysis-jobs[\s\S]*?"Idempotency-Key": crypto\.randomUUID\(\)/,
  );
});

test("compose file mounts only true file secrets without creating missing host directories", () => {
  const compose = source("docker-compose.yml");
  assert.equal((compose.match(/create_host_path: false/g) ?? []).length, 1);
  assert.match(compose, /GCP_SERVICE_ACCOUNT_FILE[\s\S]*?create_host_path: false/);
  assert.doesNotMatch(compose, /VIENEU_REFERENCE_AUDIO_FILE/);
});

test("local quality gate includes backend verify and worker static analysis", () => {
  const verification = source("scripts", "verify-local.py");
  assert.match(verification, /Step\("Backend verify", backend, \[mvnw, "verify"\]\)/);
  assert.match(verification, /"ruff", "check", "src", "tests"/);
  assert.match(verification, /"mypy", "src"/);
});

test("desktop renderer keeps Node isolation while disabling Chromium sandbox", () => {
  const main = source("app", "desktop", "src", "main", "main.ts");
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: false/);
});

test("desktop removes the native application menu", () => {
  const main = source("app", "desktop", "src", "main", "main.ts");
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
});
