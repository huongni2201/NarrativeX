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

test("project catalog persists project metadata and last-opened project", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-catalog-"));
  try {
    const storage = new ProjectStorage(root);
    const catalog = new ProjectCatalog(storage);

    await catalog.upsert(project(projectId, "Guest project"));
    await catalog.upsert(project(secondProjectId, "Second project"));
    await catalog.touch(projectId);

    const reopened = new ProjectCatalog(new ProjectStorage(root));
    const entries = await reopened.list();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].project.id, projectId);
    assert.equal(entries[0].project.name, "Guest project");
    assert.equal(entries[0].syncStatus, "LOCAL_ONLY");
    assert.equal(entries[0].workspacePath, join(root, projectId));
    assert.equal((await reopened.lastOpened())?.project.id, projectId);

    const snapshot = JSON.parse(
      await readFile(join(root, projectId, "project.json"), "utf8"),
    );
    assert.equal(snapshot.project.id, projectId);
    assert.equal(snapshot.schemaVersion, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project catalog rebuilds registry from per-project snapshots", async () => {
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

test("remote reconcile updates known projects without deleting local-only projects", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-catalog-reconcile-"));
  try {
    const catalog = new ProjectCatalog(new ProjectStorage(root));
    await catalog.upsert(project(projectId, "Local guest project"));
    await catalog.upsert(project(secondProjectId, "Remote project"));

    const reconciled = await catalog.reconcile([
      project(secondProjectId, "Remote project renamed"),
    ]);

    assert.equal(reconciled.length, 2);
    assert.equal(
      reconciled.find((entry) => entry.project.id === projectId)?.project.name,
      "Local guest project",
    );
    assert.equal(
      reconciled.find((entry) => entry.project.id === secondProjectId)?.project.name,
      "Remote project renamed",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
