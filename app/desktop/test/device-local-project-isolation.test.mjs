import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const repoRoot = resolve(desktopRoot, "..", "..");

function source(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("project discovery is device-local and does not reconcile backend project lists", () => {
  const queries = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "projects",
    "queries",
    "projects.queries.ts",
  );
  const api = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "projects",
    "api",
    "projects.api.ts",
  );

  assert.match(queries, /window\.narrativex\.localProjects\.list\(\)/);
  assert.match(queries, /window\.narrativex\.localProjects\.upsert\(project\)/);
  assert.doesNotMatch(queries, /projectsApi\.list\(\)/);
  assert.doesNotMatch(queries, /localProjects\.reconcile\(/);
  assert.doesNotMatch(queries, /mergeProjects\(/);
  assert.doesNotMatch(api, /\blist\s*:/);
});

test("project detail requires local registration before backend access", () => {
  const queries = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "projects",
    "queries",
    "projects.queries.ts",
  );

  const localLookup = queries.indexOf("localProjects.find((project) => project.id === projectId)");
  const backendLookup = queries.indexOf("projectsApi.get(projectId)");
  assert.ok(localLookup >= 0, "expected a local project lookup");
  assert.ok(backendLookup > localLookup, "backend detail must run after local registration check");
  assert.match(queries, /Project is not available on this device\./);
});

test("workspace resource queries wait for the device-local project gate", () => {
  const workspace = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "workspace",
    "queries",
    "useProjectWorkspace.ts",
  );

  assert.match(workspace, /const projectAvailable = enabled && projectQuery\.isSuccess;/);
  assert.match(workspace, /enabled: projectAvailable && requirements\.timeline/);
  assert.match(workspace, /projectAvailable && requirements\.chapters/);
  assert.match(workspace, /enabled: projectAvailable && hasAssets/);
  assert.match(workspace, /enabled: projectAvailable && requirements\.characters/);
  assert.match(workspace, /enabled: projectAvailable && requirements\.voices/);
  assert.match(workspace, /enabled: projectAvailable && requirements\.presets/);
});

test("renderer bridge exposes no project synchronization surface", () => {
  const preload = source("app", "desktop", "src", "preload", "index.ts");
  const types = source("app", "desktop", "src", "preload", "types.ts");
  const ipc = source(
    "app",
    "desktop",
    "src",
    "main",
    "local-storage",
    "project-catalog-ipc.ts",
  );
  const catalog = source(
    "app",
    "desktop",
    "src",
    "main",
    "local-storage",
    "project-catalog.ts",
  );

  assert.doesNotMatch(preload, /projects-local:reconcile/);
  assert.doesNotMatch(types, /LocalProjectSyncStatus|cloudProjectId|syncStatus/);
  assert.doesNotMatch(ipc, /projects-local:reconcile|cloudProjectId|syncStatus/);
  assert.doesNotMatch(catalog, /\breconcile\s*\(|cloudProjectId|syncStatus/);
  assert.match(catalog, /CATALOG_SCHEMA_VERSION = 2/);
  assert.match(catalog, /PROJECT_SNAPSHOT_SCHEMA_VERSION = 2/);
});

test("project media contracts contain no storage-mode abstraction", () => {
  const assetContracts = source("packages", "client-contracts", "src", "asset.ts");
  const productionContracts = source("packages", "client-contracts", "src", "production.ts");

  assert.doesNotMatch(assetContracts, /storageMode|LOCAL_ONLY|PROJECT_LOCAL|HYBRID/);
  assert.doesNotMatch(productionContracts, /BeatMediaStorageMode|storageMode|LOCAL_ONLY|PROJECT_LOCAL|HYBRID/);
});
