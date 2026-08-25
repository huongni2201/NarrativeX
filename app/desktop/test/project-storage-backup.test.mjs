import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStorage } from "../src/main/local-storage/project-storage.ts";

const projectId = "00000000-0000-0000-0000-000000000001";

test("project storage creates a manifest-verified backup and restores it safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-storage-"));
  const backupRoot = await mkdtemp(join(tmpdir(), "narrativex-backup-"));
  const archiveRoot = await mkdtemp(join(tmpdir(), "narrativex-archive-"));
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
    await writeFile(join(root, projectId, "cache", "segments", "cached.txt"), "cache data", "utf8");

    const summary = await storage.storageSummary(projectId);
    assert.equal(summary.cacheBytes, "cache data".length);
    assert.ok(summary.totalBytes >= summary.assetBytes + summary.cacheBytes);

    const backup = await storage.createBackup(projectId, backupRoot);
    const backupDirectory = join(backupRoot, (await readdir(backupRoot))[0]);
    assert.match(backupDirectory, /\.narrativex$/);
    assert.match(backup.snapshotId, /^[0-9a-f-]{36}$/);
    assert.equal(summary.managedBackupBytes, 0);
    const afterBackup = await storage.storageSummary(projectId);
    assert.equal(afterBackup.managedBackupBytes, backup.sizeBytes);
    assert.equal(afterBackup.backupBytes, backup.sizeBytes);
    assert.equal(await readFile(join(backupDirectory, "project.manifest.json"), "utf8").then((value) => value.includes('"schemaVersion": 2')), true);

    const archive = await storage.archiveProject(projectId, archiveRoot);
    assert.equal(archive.sizeBytes > 0, true);
    assert.equal(await storage.resolveAsset(projectId, "asset-1").then((path) => readFile(path, "utf8")), "workspace data");

    const restored = await storage.restoreBackup({ backupDirectory, replaceExisting: true });
    assert.equal(restored.projectId, projectId);
    assert.equal(restored.replacedExisting, true);
    assert.match(restored.previousProjectSnapshotId, /^[0-9a-f-]{36}$/);
    const afterRestore = await storage.storageSummary(projectId);
    assert.equal(afterRestore.managedBackupBytes, backup.sizeBytes);
    assert.equal(afterRestore.preRestoreSnapshotBytes, backup.sizeBytes);
    assert.equal(await storage.resolveAsset(projectId, "asset-1").then((path) => readFile(path, "utf8")), "workspace data");

    const unmanagedSibling = join(root, `${projectId}.before-restore-unmanaged`);
    await writeFile(unmanagedSibling, "unmanaged", "utf8");
    const withUnmanagedSibling = await storage.storageSummary(projectId);
    assert.equal(withUnmanagedSibling.backupBytes, afterRestore.backupBytes);
    assert.equal(await storage.deleteManagedSnapshot(projectId, backup.snapshotId), true);
    const afterBackupCleanup = await storage.storageSummary(projectId);
    assert.equal(afterBackupCleanup.managedBackupBytes, 0);
    assert.equal(afterBackupCleanup.preRestoreSnapshotBytes, backup.sizeBytes);
    assert.equal(await storage.deleteManagedSnapshot(projectId, restored.previousProjectSnapshotId), true);
    const afterRestoreCleanup = await storage.storageSummary(projectId);
    assert.equal(afterRestoreCleanup.backupBytes, 0);
    assert.equal(await readFile(unmanagedSibling, "utf8"), "unmanaged");
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(backupRoot, { recursive: true, force: true }),
      rm(archiveRoot, { recursive: true, force: true }),
      rm(source, { recursive: true, force: true }),
    ]);
  }
});

test("storage accounting ignores symlink targets outside the project boundary", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-storage-symlink-"));
  const outside = await mkdtemp(join(tmpdir(), "narrativex-storage-outside-"));
  try {
    const storage = new ProjectStorage(root);
    await storage.ensureProject(projectId);
    const target = join(outside, "secret.bin");
    const link = join(root, projectId, "cache", "segments", "outside.bin");
    await writeFile(target, "must not be counted", "utf8");
    try {
      await symlink(target, link);
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") {
        t.skip("symlink creation is not permitted on this host");
        return;
      }
      throw error;
    }
    const summary = await storage.storageSummary(projectId);
    assert.equal(summary.cacheBytes, 0);
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});
