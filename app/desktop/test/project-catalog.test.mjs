import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectCatalog } from "../src/main/local-storage/project-catalog.ts";
import { ProjectStorage } from "../src/main/local-storage/project-storage.ts";

const projectId = "00000000-0000-0000-0000-000000000001";
const secondProjectId = "00000000-0000-0000-0000-000000000002";

function project(id, name) {
  return {
    id,
    name,
    description: null,
    coverImageUrl: null,
    status: "DRAFT",
    metrics: { totalChapters: 0, totalScenes: 0, estimatedDurationSeconds: 0 },
  };
}

test("project catalog persists device-local project metadata and last-opened project", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-catalog-"));
  try {
    const storage = new ProjectStorage(root);
    const catalog = new ProjectCatalog(storage);

    await catalog.upsert(project(projectId, "Local project"));
    await catalog.upsert(project(secondProjectId, "Second project"));
    await catalog.touch(projectId);

    const reopened = new ProjectCatalog(new ProjectStorage(root));
    const entries = await reopened.list();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].project.id, projectId);
    assert.equal(entries[0].project.name, "Local project");
    assert.equal(entries[0].workspacePath, join(root, projectId));
    assert.equal((await reopened.lastOpened())?.project.id, projectId);
    assert.equal("cloudProjectId" in entries[0], false);
    assert.equal("syncStatus" in entries[0], false);

    const snapshot = JSON.parse(
      await readFile(join(root, projectId, "project.json"), "utf8"),
    );
    assert.equal(snapshot.project.id, projectId);
    assert.equal(snapshot.schemaVersion, 2);
    assert.equal(snapshot.archived, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project catalog rebuilds registry from local per-project snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-catalog-recovery-"));
  try {
    const storage = new ProjectStorage(root);
    const catalog = new ProjectCatalog(storage);
    await catalog.upsert(project(projectId, "Recover me"));

    await writeFile(join(root, "project-registry.json"), "{not-json", "utf8");

    const recovered = new ProjectCatalog(new ProjectStorage(root));
    const entries = await recovered.list();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].project.id, projectId);
    assert.equal(entries[0].project.name, "Recover me");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("markArchived hides a project without deleting its local snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-catalog-archived-"));
  try {
    const catalog = new ProjectCatalog(new ProjectStorage(root));
    await catalog.upsert(project(projectId, "Local project"));
    await catalog.touch(projectId);

    await catalog.markArchived(projectId);

    assert.deepEqual(await catalog.list(), []);
    assert.equal(await catalog.lastOpened(), null);
    const snapshot = JSON.parse(
      await readFile(join(root, projectId, "project.json"), "utf8"),
    );
    assert.equal(snapshot.project.id, projectId);
    assert.equal(snapshot.archived, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("upsert restores an archived local project without remote reconciliation", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-catalog-restore-"));
  try {
    const catalog = new ProjectCatalog(new ProjectStorage(root));
    await catalog.upsert(project(projectId, "Local project"));
    await catalog.markArchived(projectId);
    assert.deepEqual(await catalog.list(), []);

    await catalog.upsert(project(projectId, "Local project restored"));

    const entries = await catalog.list();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].project.name, "Local project restored");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
