import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStorage } from "../src/main/local-storage/project-storage.ts";

const projectId = "00000000-0000-0000-0000-000000000001";

test("project storage creates a manifest-verified backup and restores it safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-storage-"));
  const backupRoot = await mkdtemp(join(tmpdir(), "narrativex-backup-"));
  const source = await mkdtemp(join(tmpdir(), "narrativex-source-"));
  try {
    const storage = new ProjectStorage(root);
    await storage.ensureProject(projectId);
    await writeFile(join(source, "note.txt"), "workspace data", "utf8");
    await storage.registerAsset(projectId, {
      assetId: "asset-1",
      kind: "OTHER",
      sourcePath: join(source, "note.txt"),
    });

    const backup = await storage.createBackup(projectId, backupRoot);
    assert.match(backup.backupDirectory, /\.narrativex$/);
    assert.equal(await readFile(join(backup.backupDirectory, "project.manifest.json"), "utf8").then((value) => value.includes('"schemaVersion": 2')), true);

    const restored = await storage.restoreBackup({ backupDirectory: backup.backupDirectory, replaceExisting: true });
    assert.equal(restored.projectId, projectId);
    assert.ok(restored.previousProjectDirectory);
    assert.equal(await storage.resolveAsset(projectId, "asset-1").then((path) => readFile(path, "utf8")), "workspace data");
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(backupRoot, { recursive: true, force: true }),
      rm(source, { recursive: true, force: true }),
    ]);
  }
});
