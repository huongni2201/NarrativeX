import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  lstat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";

const MANIFEST_SCHEMA_VERSION = 2 as const;
const SNAPSHOT_REGISTRY_SCHEMA_VERSION = 1 as const;
const PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type LocalAssetKind = "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";

export interface LocalAssetManifestEntry {
  assetId: string;
  kind: LocalAssetKind;
  relativePath: string;
  sizeBytes: number;
  checksumSha256: string;
  updatedAt: string;
}

export interface LocalArtifactManifestEntry {
  jobId: string;
  relativePath: string;
  sizeBytes: number;
  checksumSha256: string;
  updatedAt: string;
}

export interface LocalProjectManifest {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  assets: Record<string, LocalAssetManifestEntry>;
  artifacts: Record<string, LocalArtifactManifestEntry>;
}

export interface RegisterLocalAssetInput {
  assetId: string;
  kind: LocalAssetKind;
  sourcePath: string;
  checksumSha256?: string;
}

export interface RegisterLocalArtifactInput {
  jobId: string;
  sourcePath: string;
  checksumSha256?: string;
}

export interface LocalStorageSummary {
  projectId: string;
  totalBytes: number;
  assetBytes: number;
  artifactBytes: number;
  workBytes: number;
  cacheBytes: number;
  backupBytes: number;
  managedBackupBytes: number;
  preRestoreSnapshotBytes: number;
  otherNarrativeXOwnedBytes: number;
  assetCount: number;
  artifactCount: number;
  managedSnapshots: ManagedSnapshotSummary[];
}

export interface LocalProjectBackup {
  projectId: string;
  snapshotId: string;
  manifestSchemaVersion: number;
  createdAt: string;
  sizeBytes: number;
}

export interface LocalProjectBackupInspection {
  projectId: string;
  manifestSchemaVersion: number;
  targetExists: boolean;
}

export interface LocalProjectRestoreInput {
  backupDirectory: string;
  replaceExisting?: boolean;
}

export interface LocalProjectRestoreResult {
  projectId: string;
  replacedExisting: boolean;
  previousProjectSnapshotId: string | null;
}

export interface LocalProjectArchiveResult {
  projectId: string;
  sizeBytes: number;
}

type ManagedSnapshotType = "BACKUP" | "PRE_RESTORE";

export interface ManagedSnapshotSummary {
  snapshotId: string;
  type: ManagedSnapshotType;
  createdAt: string;
  sizeBytes: number;
}

interface ManagedSnapshotRecord {
  snapshotId: string;
  projectId: string;
  type: ManagedSnapshotType;
  path: string;
  createdAt: string;
  sizeBytes: number;
  cleanupPolicy: "RETAIN_UNTIL_EXPLICIT_DELETE";
}

interface SnapshotRegistry {
  schemaVersion: typeof SNAPSHOT_REGISTRY_SCHEMA_VERSION;
  snapshots: Record<string, ManagedSnapshotRecord>;
}

export class ProjectStorage {
  private readonly projectLocks = new Map<string, Promise<void>>();
  private readonly projectsRoot: string;
  private snapshotRegistryLock: Promise<void> = Promise.resolve();

  constructor(projectsRoot: string) {
    this.projectsRoot = projectsRoot;
  }

  rootDirectory(): string { return this.projectsRoot; }

  async ensureProject(projectId: string): Promise<LocalProjectManifest> {
    return this.withProjectLock(projectId, async () => {
      await this.assertSafeDirectoryOrMissing(resolve(this.projectsRoot), "Projects root");
      const root = this.projectRoot(projectId);
      await this.assertSafeDirectoryOrMissing(root, "Project root");
      await mkdir(root, { recursive: true });
      await this.assertSafeDirectoryOrMissing(root, "Project root");
      await Promise.all([
        mkdir(join(root, "assets", "images"), { recursive: true }),
        mkdir(join(root, "assets", "audio"), { recursive: true }),
        mkdir(join(root, "assets", "video"), { recursive: true }),
        mkdir(join(root, "assets", "other"), { recursive: true }),
        mkdir(join(root, "artifacts"), { recursive: true }),
        mkdir(join(root, "work"), { recursive: true }),
        mkdir(join(root, "cache", "segments"), { recursive: true }),
        mkdir(join(root, "backups"), { recursive: true }),
      ]);
      const existing = await this.readManifest(projectId);
      if (existing) return existing;

      const now = new Date().toISOString();
      const manifest: LocalProjectManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        projectId,
        createdAt: now,
        updatedAt: now,
        assets: {},
        artifacts: {},
      };
      await this.writeManifest(manifest);
      return manifest;
    });
  }

  async registerAsset(
    projectId: string,
    input: RegisterLocalAssetInput,
  ): Promise<LocalAssetManifestEntry> {
    await this.ensureProject(projectId);
    validateAssetId(input.assetId);
    const source = resolve(input.sourcePath);
    const sourceStat = await stat(source);
    if (!sourceStat.isFile()) throw new Error("Local asset source must be a file.");
    const sourceChecksum = await verifyOrCalculateChecksum(source, input.checksumSha256);

    return this.withProjectLock(projectId, async () => {
      const manifest = await this.requireManifest(projectId);
      const existing = manifest.assets[input.assetId];
      if (existing) {
        if (
          existing.checksumSha256 !== sourceChecksum ||
          existing.sizeBytes !== sourceStat.size ||
          existing.kind !== input.kind
        ) {
          throw new Error(
            `Local asset ${input.assetId} is immutable and already points to different content.`,
          );
        }

        const destination = this.resolveProjectRelativePath(projectId, existing.relativePath);
        if (await fileMatches(destination, existing.sizeBytes, existing.checksumSha256)) {
          return existing;
        }

        await mkdir(dirname(destination), { recursive: true });
        if (source !== destination) await copyFile(source, destination);
        if (!(await fileMatches(destination, existing.sizeBytes, existing.checksumSha256))) {
          throw new Error(`Local asset ${input.assetId} could not be repaired from verified bytes.`);
        }
        existing.updatedAt = new Date().toISOString();
        await this.writeManifest(manifest);
        return existing;
      }

      const extension = safeExtension(source);
      const relativePath = join(
        "assets",
        assetDirectory(input.kind),
        `${input.assetId}${extension}`,
      );
      const destination = this.resolveProjectRelativePath(projectId, relativePath);
      await mkdir(dirname(destination), { recursive: true });
      if (source !== destination) await copyFile(source, destination);

      const destinationStat = await stat(destination);
      const destinationChecksum = await sha256File(destination);
      if (
        destinationStat.size !== sourceStat.size ||
        destinationChecksum !== sourceChecksum
      ) {
        throw new Error(`Local asset ${input.assetId} changed while it was being registered.`);
      }

      const entry: LocalAssetManifestEntry = {
        assetId: input.assetId,
        kind: input.kind,
        relativePath: toManifestPath(relativePath),
        sizeBytes: destinationStat.size,
        checksumSha256: destinationChecksum,
        updatedAt: new Date().toISOString(),
      };
      manifest.assets[input.assetId] = entry;
      await this.writeManifest(manifest);
      return entry;
    });
  }

  async registerArtifact(
    projectId: string,
    input: RegisterLocalArtifactInput,
  ): Promise<LocalArtifactManifestEntry> {
    await this.ensureProject(projectId);
    validateOpaqueId(input.jobId, "jobId");
    const source = resolve(input.sourcePath);
    const sourceStat = await stat(source);
    if (!sourceStat.isFile()) throw new Error("Local artifact source must be a file.");
    const sourceChecksum = await verifyOrCalculateChecksum(source, input.checksumSha256);

    return this.withProjectLock(projectId, async () => {
      const manifest = await this.requireManifest(projectId);
      const existing = manifest.artifacts[input.jobId];
      if (existing) {
        if (
          existing.checksumSha256 !== sourceChecksum ||
          existing.sizeBytes !== sourceStat.size
        ) {
          throw new Error(
            `Local artifact ${input.jobId} is immutable and already points to different content.`,
          );
        }

        const destination = this.resolveProjectRelativePath(projectId, existing.relativePath);
        if (await fileMatches(destination, existing.sizeBytes, existing.checksumSha256)) {
          return existing;
        }

        await mkdir(dirname(destination), { recursive: true });
        if (source !== destination) await copyFile(source, destination);
        if (!(await fileMatches(destination, existing.sizeBytes, existing.checksumSha256))) {
          throw new Error(
            `Local artifact ${input.jobId} could not be repaired from verified render bytes.`,
          );
        }
        existing.updatedAt = new Date().toISOString();
        await this.writeManifest(manifest);
        return existing;
      }

      const relativePath = join(
        "artifacts",
        input.jobId,
        `final${safeExtension(source) || ".mp4"}`,
      );
      const destination = this.resolveProjectRelativePath(projectId, relativePath);
      await mkdir(dirname(destination), { recursive: true });
      if (source !== destination) await copyFile(source, destination);

      const destinationStat = await stat(destination);
      const destinationChecksum = await sha256File(destination);
      if (
        destinationStat.size !== sourceStat.size ||
        destinationChecksum !== sourceChecksum
      ) {
        throw new Error(`Local artifact ${input.jobId} changed while it was being registered.`);
      }

      const entry: LocalArtifactManifestEntry = {
        jobId: input.jobId,
        relativePath: toManifestPath(relativePath),
        sizeBytes: destinationStat.size,
        checksumSha256: destinationChecksum,
        updatedAt: new Date().toISOString(),
      };
      manifest.artifacts[input.jobId] = entry;
      await this.writeManifest(manifest);
      return entry;
    });
  }

  async resolveAsset(
    projectId: string,
    assetId: string,
    expected?: { sizeBytes?: number; checksumSha256?: string },
  ): Promise<string> {
    validateAssetId(assetId);
    const manifest = await this.ensureProject(projectId);
    const entry = manifest.assets[assetId];
    if (!entry) {
      throw new Error(
        `Local asset ${assetId} is not registered for project ${projectId}.`,
      );
    }
    const absolutePath = this.resolveProjectRelativePath(projectId, entry.relativePath);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) throw new Error(`Local asset ${assetId} is missing from disk.`);

    const expectedSize = expected?.sizeBytes ?? entry.sizeBytes;
    if (expectedSize > 0 && fileStat.size !== expectedSize) {
      throw new Error(`Local asset ${assetId} size does not match its manifest.`);
    }
    const expectedChecksum = normalizeChecksum(
      expected?.checksumSha256 ?? entry.checksumSha256,
    );
    if (expectedChecksum) {
      const actual = await sha256File(absolutePath);
      if (actual !== expectedChecksum) {
        throw new Error(`Local asset ${assetId} checksum does not match its manifest.`);
      }
    }
    return absolutePath;
  }

  async resolveArtifact(projectId: string, jobId: string): Promise<string> {
    validateOpaqueId(jobId, "jobId");
    const manifest = await this.ensureProject(projectId);
    const entry = manifest.artifacts[jobId];
    if (!entry) {
      throw new Error(
        `Local artifact ${jobId} is not registered for project ${projectId}.`,
      );
    }
    const absolutePath = this.resolveProjectRelativePath(projectId, entry.relativePath);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile() || fileStat.size !== entry.sizeBytes) {
      throw new Error(`Local artifact ${jobId} is missing or invalid.`);
    }
    if (await sha256File(absolutePath) !== entry.checksumSha256) {
      throw new Error(`Local artifact ${jobId} checksum does not match its manifest.`);
    }
    return absolutePath;
  }

  async artifactEntry(projectId: string, jobId: string): Promise<LocalArtifactManifestEntry> {
    validateOpaqueId(jobId, "jobId");
    const manifest = await this.ensureProject(projectId);
    const entry = manifest.artifacts[jobId];
    if (!entry) throw new Error(`Local artifact ${jobId} is not registered.`);
    return entry;
  }

  projectDirectory(projectId: string): string {
    return this.projectRoot(projectId);
  }

  async storageSummary(projectId: string): Promise<LocalStorageSummary> {
    const manifest = await this.ensureProject(projectId);
    const root = this.projectRoot(projectId);
    const [assetBytes, artifactBytes, workBytes, cacheBytes, otherNarrativeXOwnedBytes, snapshots] = await Promise.all([
      directorySize(join(root, "assets")),
      directorySize(join(root, "artifacts")),
      directorySize(join(root, "work")),
      directorySize(join(root, "cache")),
      directChildrenSize(root, new Set(["assets", "artifacts", "work", "cache", "backups"])),
      this.snapshotSummary(projectId),
    ]);
    const backupBytes = snapshots.managedBackupBytes + snapshots.preRestoreSnapshotBytes;
    return {
      projectId,
      totalBytes: assetBytes + artifactBytes + workBytes + cacheBytes + otherNarrativeXOwnedBytes + backupBytes,
      assetBytes,
      artifactBytes,
      workBytes,
      cacheBytes,
      backupBytes,
      managedBackupBytes: snapshots.managedBackupBytes,
      preRestoreSnapshotBytes: snapshots.preRestoreSnapshotBytes,
      otherNarrativeXOwnedBytes,
      assetCount: Object.keys(manifest.assets).length,
      artifactCount: Object.keys(manifest.artifacts).length,
      managedSnapshots: snapshots.managedSnapshots,
    };
  }

  async verifyAssets(projectId: string): Promise<Array<{ assetId: string; state: "AVAILABLE" | "MISSING" | "CORRUPT" }>> {
    const manifest = await this.ensureProject(projectId);
    const result: Array<{ assetId: string; state: "AVAILABLE" | "MISSING" | "CORRUPT" }> = [];
    for (const entry of Object.values(manifest.assets)) {
      try {
        await this.resolveAsset(projectId, entry.assetId);
        result.push({ assetId: entry.assetId, state: "AVAILABLE" });
      } catch (error) {
        result.push({ assetId: entry.assetId, state: /missing|not registered/i.test(error instanceof Error ? error.message : "") ? "MISSING" : "CORRUPT" });
      }
    }
    return result;
  }

  async cleanupCompletedWork(projectId: string): Promise<number> {
    await this.ensureProject(projectId);
    const workRoot = join(this.projectRoot(projectId), "work");
    let removed = 0;
    for (const entry of await readdir(workRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const journalPath = join(workRoot, entry.name, "render.state.json");
      try {
        const journal = JSON.parse(await readFile(journalPath, "utf8")) as { stage?: string };
        if (journal.stage === "COMPLETED" || journal.stage === "FAILED" || journal.stage === "CANCELLED") {
          await rm(join(workRoot, entry.name), { recursive: true, force: true });
          removed += 1;
        }
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }
    return removed;
  }

  async createBackup(projectId: string, destinationDirectory: string): Promise<LocalProjectBackup> {
    await this.ensureProject(projectId);
    return this.withProjectLock(projectId, async () => {
      const manifest = await this.requireManifest(projectId);
      const source = this.projectRoot(projectId);
      await this.assertNoSymlinks(source, "Active project workspace");
      const destinationRoot = resolve(destinationDirectory);
      await this.assertSafeDirectoryOrMissing(destinationRoot, "Backup destination");
      await mkdir(destinationRoot, { recursive: true });
      const backupDirectory = join(
        destinationRoot,
        `${projectId.toLowerCase()}-${backupTimestamp()}.narrativex`,
      );
      if (isPathInside(source, backupDirectory)) {
        throw new Error("Backup destination must be outside the active project workspace.");
      }
      try {
        await cp(source, backupDirectory, { recursive: true, errorOnExist: true });
        await this.assertNoSymlinks(backupDirectory, "Backup snapshot");
        const backupManifest = await readBackupManifest(backupDirectory);
        const sizeBytes = await directorySize(backupDirectory);
        const snapshot = await this.registerManagedSnapshot({
          snapshotId: randomUUID(),
          projectId: backupManifest.projectId,
          type: "BACKUP",
          path: backupDirectory,
          createdAt: new Date().toISOString(),
          sizeBytes,
          cleanupPolicy: "RETAIN_UNTIL_EXPLICIT_DELETE",
        });
        return {
          projectId: manifest.projectId,
          snapshotId: snapshot.snapshotId,
          manifestSchemaVersion: manifest.schemaVersion,
          createdAt: snapshot.createdAt,
          sizeBytes,
        };
      } catch (error) {
        await rm(backupDirectory, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
    });
  }

  async inspectBackup(backupDirectory: string): Promise<LocalProjectBackupInspection> {
    const source = resolve(backupDirectory);
    await this.assertSafeDirectoryOrMissing(resolve(this.projectsRoot), "Projects root");
    await this.assertNoSymlinkAncestors(source, "Restore source");
    await this.assertNoSymlinks(source, "Restore source");
    const backupManifest = await readBackupManifest(source);
    return this.withProjectLock(backupManifest.projectId, async () => {
      const destination = this.projectRoot(backupManifest.projectId);
      await this.assertSafeDirectoryOrMissing(destination, "Project root");
      if (isPathInside(destination, source)) {
        throw new Error("Restore source must be outside the active project workspace.");
      }
      return {
        projectId: backupManifest.projectId,
        manifestSchemaVersion: backupManifest.schemaVersion,
        targetExists: await directoryExists(destination),
      };
    });
  }

  async restoreBackup(input: LocalProjectRestoreInput): Promise<LocalProjectRestoreResult> {
    const backupDirectory = resolve(input.backupDirectory);
    await this.assertSafeDirectoryOrMissing(resolve(this.projectsRoot), "Projects root");
    await this.assertNoSymlinkAncestors(backupDirectory, "Restore source");
    await this.assertNoSymlinks(backupDirectory, "Restore source");
    const backupManifest = await readBackupManifest(backupDirectory);
    const projectId = backupManifest.projectId;
    return this.withProjectLock(projectId, async () => {
      const destination = this.projectRoot(projectId);
      await this.assertSafeDirectoryOrMissing(destination, "Project root");
      const activeProjectDirectory = await directoryExists(destination) ? destination : null;
      if (activeProjectDirectory && !input.replaceExisting) {
        throw new Error(`Project ${projectId} already exists. Confirm replacement before restoring.`);
      }
      if (isPathInside(destination, backupDirectory)) {
        throw new Error("Restore source must be outside the active project workspace.");
      }

      const staging = join(resolve(this.projectsRoot), `.restore-${projectId}-${process.pid}-${Date.now()}`);
      await cp(backupDirectory, staging, { recursive: true, errorOnExist: true });
      await this.assertNoSymlinks(staging, "Restore staging directory");
      let preservedPreviousDirectory: string | null = null;
      let previousProjectSnapshot: ManagedSnapshotRecord | null = null;
      try {
        if (activeProjectDirectory) {
          preservedPreviousDirectory = `${destination}.before-restore-${Date.now()}`;
          previousProjectSnapshot = await this.registerManagedSnapshot({
            snapshotId: randomUUID(),
            projectId,
            type: "PRE_RESTORE",
            path: preservedPreviousDirectory,
            createdAt: new Date().toISOString(),
            sizeBytes: await directorySize(destination),
            cleanupPolicy: "RETAIN_UNTIL_EXPLICIT_DELETE",
          });
          await rename(destination, preservedPreviousDirectory);
        }
        await rename(staging, destination);
      } catch (error) {
        await rm(staging, { recursive: true, force: true }).catch(() => undefined);
        if (previousProjectSnapshot) {
          await this.removeSnapshotRecord(previousProjectSnapshot.snapshotId).catch(() => undefined);
        }
        if (preservedPreviousDirectory && !(await directoryExists(destination))) {
          await rename(preservedPreviousDirectory, destination).catch(() => undefined);
        }
        throw error;
      }
      return {
        projectId,
        replacedExisting: activeProjectDirectory !== null,
        previousProjectSnapshotId: previousProjectSnapshot?.snapshotId ?? null,
      };
    });
  }

  async deleteManagedSnapshot(projectId: string, snapshotId: string): Promise<boolean> {
    await this.ensureProject(projectId);
    return this.withProjectLock(projectId, async () => {
      const registry = await this.readSnapshotRegistry();
      const snapshot = registry.snapshots[snapshotId];
      if (!snapshot || snapshot.projectId !== projectId) return false;

      let snapshotExists = true;
      try {
        await this.assertManagedSnapshotPath(snapshot);
      } catch (error) {
        if (!isMissingFile(error)) throw error;
        snapshotExists = false;
      }
      if (snapshotExists) await rm(snapshot.path, { recursive: true, force: true });
      await this.removeSnapshotRecord(snapshotId);
      return true;
    });
  }

  async archiveProject(projectId: string, destinationDirectory: string): Promise<LocalProjectArchiveResult> {
    await this.ensureProject(projectId);
    return this.withProjectLock(projectId, async () => {
      const source = this.projectRoot(projectId);
      const destinationRoot = resolve(destinationDirectory);
      await this.assertNoSymlinks(source, "Active project workspace");
      await this.assertSafeDirectoryOrMissing(destinationRoot, "Archive destination");
      await mkdir(destinationRoot, { recursive: true });
      const archiveDirectory = join(
        destinationRoot,
        `${projectId.toLowerCase()}-${backupTimestamp()}.narrativex`,
      );
      if (isPathInside(source, archiveDirectory)) {
        throw new Error("Archive destination must be outside the active project workspace.");
      }
      try {
        await cp(source, archiveDirectory, { recursive: true, errorOnExist: true });
        await readBackupManifest(archiveDirectory);
        return { projectId, sizeBytes: await directorySize(archiveDirectory) };
      } catch (error) {
        await rm(archiveDirectory, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
    });
  }

  private projectRoot(projectId: string): string {
    if (!PROJECT_ID_PATTERN.test(projectId)) {
      throw new Error("Invalid projectId for local storage.");
    }
    return join(resolve(this.projectsRoot), projectId.toLowerCase());
  }

  private async snapshotSummary(projectId: string): Promise<{
    managedBackupBytes: number;
    preRestoreSnapshotBytes: number;
    managedSnapshots: ManagedSnapshotSummary[];
  }> {
    const registry = await this.readSnapshotRegistry();
    let managedBackupBytes = 0;
    let preRestoreSnapshotBytes = 0;
    const managedSnapshots: ManagedSnapshotSummary[] = [];
    for (const snapshot of Object.values(registry.snapshots)) {
      if (snapshot.projectId !== projectId) continue;
      const sizeBytes = await this.safeManagedSnapshotSize(snapshot);
      if (sizeBytes === null) continue;
      if (snapshot.type === "BACKUP") managedBackupBytes += sizeBytes;
      else preRestoreSnapshotBytes += sizeBytes;
      managedSnapshots.push({
        snapshotId: snapshot.snapshotId,
        type: snapshot.type,
        createdAt: snapshot.createdAt,
        sizeBytes,
      });
    }
    managedSnapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return { managedBackupBytes, preRestoreSnapshotBytes, managedSnapshots };
  }

  private async registerManagedSnapshot(snapshot: ManagedSnapshotRecord): Promise<ManagedSnapshotRecord> {
    this.assertSnapshotLocation(snapshot);
    return this.withSnapshotRegistryLock(async () => {
      const registry = await this.readSnapshotRegistry();
      registry.snapshots[snapshot.snapshotId] = snapshot;
      await this.writeSnapshotRegistry(registry);
      return snapshot;
    });
  }

  private async removeSnapshotRecord(snapshotId: string): Promise<void> {
    await this.withSnapshotRegistryLock(async () => {
      const registry = await this.readSnapshotRegistry();
      delete registry.snapshots[snapshotId];
      await this.writeSnapshotRegistry(registry);
    });
  }

  private async safeManagedSnapshotSize(snapshot: ManagedSnapshotRecord): Promise<number | null> {
    try {
      await this.assertManagedSnapshotPath(snapshot);
      return await directorySize(snapshot.path);
    } catch (error) {
      if (isMissingFile(error)) return null;
      return null;
    }
  }

  private async assertManagedSnapshotPath(snapshot: ManagedSnapshotRecord): Promise<void> {
    this.assertSnapshotLocation(snapshot);
    const rootStat = await lstat(snapshot.path);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new Error(`Managed snapshot ${snapshot.snapshotId} is not a real directory.`);
    }
    const manifestStat = await lstat(join(snapshot.path, "project.manifest.json"));
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
      throw new Error(`Managed snapshot ${snapshot.snapshotId} has an unsafe manifest path.`);
    }
    const manifest = await readBackupManifest(snapshot.path);
    if (manifest.projectId.toLowerCase() !== snapshot.projectId.toLowerCase()) {
      throw new Error(`Managed snapshot ${snapshot.snapshotId} belongs to another project.`);
    }
  }

  private assertSnapshotLocation(snapshot: ManagedSnapshotRecord): void {
    const candidate = resolve(snapshot.path);
    const projectRoot = this.projectRoot(snapshot.projectId);
    if (isPathInside(projectRoot, candidate)) {
      throw new Error("Managed snapshots cannot be stored inside the active project workspace.");
    }
    if (snapshot.type === "PRE_RESTORE") {
      const projectsRoot = resolve(this.projectsRoot);
      const expectedPrefix = `${basename(projectRoot)}.before-restore-`;
      if (!isPathInside(projectsRoot, candidate) || !basename(candidate).startsWith(expectedPrefix)) {
        throw new Error("Pre-restore snapshot path is outside the managed projects boundary.");
      }
      return;
    }
    if (!basename(candidate).startsWith(`${snapshot.projectId.toLowerCase()}-`) || !basename(candidate).endsWith(".narrativex")) {
      throw new Error("Managed backup path does not match the NarrativeX backup naming policy.");
    }
  }

  private async readSnapshotRegistry(): Promise<SnapshotRegistry> {
    const registryPath = this.snapshotRegistryPath();
    try {
      const registryStat = await lstat(registryPath);
      if (registryStat.isSymbolicLink() || !registryStat.isFile()) {
        throw new Error("Snapshot registry must be a regular file, not a symlink or directory.");
      }
      const parsed = JSON.parse(await readFile(registryPath, "utf8")) as Partial<SnapshotRegistry>;
      if (parsed.schemaVersion !== SNAPSHOT_REGISTRY_SCHEMA_VERSION || !parsed.snapshots || typeof parsed.snapshots !== "object") {
        throw new Error("Snapshot registry is invalid or unsupported.");
      }
      return parsed as SnapshotRegistry;
    } catch (error) {
      if (isMissingFile(error)) return { schemaVersion: SNAPSHOT_REGISTRY_SCHEMA_VERSION, snapshots: {} };
      throw error;
    }
  }

  private async writeSnapshotRegistry(registry: SnapshotRegistry): Promise<void> {
    const projectsRoot = resolve(this.projectsRoot);
    await this.assertSafeDirectoryOrMissing(projectsRoot, "Projects root");
    await mkdir(projectsRoot, { recursive: true });
    await this.assertSafeDirectoryOrMissing(projectsRoot, "Projects root");
    const destination = this.snapshotRegistryPath();
    try {
      const destinationStat = await lstat(destination);
      if (destinationStat.isSymbolicLink() || !destinationStat.isFile()) {
        throw new Error("Snapshot registry must be a regular file, not a symlink or directory.");
      }
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    const temporary = join(resolve(this.projectsRoot), `.snapshot-registry.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    await rename(temporary, destination);
  }

  private async assertSafeDirectoryOrMissing(path: string, label: string): Promise<void> {
    await this.assertNoSymlinkAncestors(path, label);
    try {
      const directoryStat = await lstat(path);
      if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
        throw new Error(`${label} must be a real directory, not a symlink or file.`);
      }
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }

  private async assertNoSymlinkAncestors(path: string, label: string): Promise<void> {
    let current = resolve(path);
    while (true) {
      try {
        if ((await lstat(current)).isSymbolicLink()) {
          throw new Error(`${label} contains a symlinked path component.`);
        }
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
      const parent = dirname(current);
      if (parent === current) return;
      current = parent;
    }
  }

  private async assertNoSymlinks(path: string, label: string): Promise<void> {
    const rootStat = await lstat(path);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      throw new Error(`${label} must be a real directory without symlinks.`);
    }
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      const childStat = await lstat(child);
      if (childStat.isSymbolicLink()) {
        throw new Error(`${label} contains an unsafe symlink: ${entry.name}.`);
      }
      if (childStat.isDirectory()) await this.assertNoSymlinks(child, label);
    }
  }

  private snapshotRegistryPath(): string {
    return join(resolve(this.projectsRoot), ".snapshot-registry.json");
  }

  private async withSnapshotRegistryLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.snapshotRegistryLock;
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    this.snapshotRegistryLock = previous.then(() => current);
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }

  private resolveProjectRelativePath(projectId: string, relativePath: string): string {
    if (!relativePath || isAbsolute(relativePath)) {
      throw new Error("Local project path must be relative.");
    }
    const root = this.projectRoot(projectId);
    const candidate = resolve(root, normalize(relativePath));
    const rel = relative(root, candidate);
    if (!rel || rel === ".") return candidate;
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error("Local project path escapes its workspace.");
    }
    return candidate;
  }

  private async requireManifest(projectId: string): Promise<LocalProjectManifest> {
    const manifest = await this.readManifest(projectId);
    if (!manifest) throw new Error(`Local project manifest is missing for ${projectId}.`);
    return manifest;
  }

  private async readManifest(projectId: string): Promise<LocalProjectManifest | null> {
    const path = join(this.projectRoot(projectId), "project.manifest.json");
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as { schemaVersion?: number; projectId?: string; createdAt?: string; updatedAt?: string; assets?: Record<string, LocalAssetManifestEntry>; artifacts?: Record<string, LocalArtifactManifestEntry> };
      if (parsed.schemaVersion === 1) {
        const migrated = migrateManifestV1ToV2(parsed, projectId);
        await this.writeManifest(migrated);
        return migrated;
      }
      if (
        parsed.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
        typeof parsed.projectId !== "string" || parsed.projectId.toLowerCase() !== projectId.toLowerCase() ||
        typeof parsed.assets !== "object" ||
        typeof parsed.artifacts !== "object"
      ) {
        throw new Error("Local project manifest is invalid or unsupported.");
      }
      return parsed as LocalProjectManifest;
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  private async writeManifest(manifest: LocalProjectManifest): Promise<void> {
    const root = this.projectRoot(manifest.projectId);
    await mkdir(root, { recursive: true });
    const destination = join(root, "project.manifest.json");
    const temporary = join(
      root,
      `.project.manifest.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
    );
    manifest.updatedAt = new Date().toISOString();
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await rename(temporary, destination);
  }

  private async withProjectLock<T>(
    projectId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const key = projectId.toLowerCase();
    const previous = this.projectLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    const queued = previous.then(() => current);
    this.projectLocks.set(key, queued);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.projectLocks.get(key) === queued) {
        this.projectLocks.delete(key);
      }
    }
  }
}

function assetDirectory(kind: LocalAssetKind): string {
  if (kind === "IMAGE") return "images";
  if (kind === "AUDIO") return "audio";
  if (kind === "VIDEO") return "video";
  return "other";
}

function safeExtension(path: string): string {
  const value = extname(basename(path)).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(value) ? value : "";
}

function validateAssetId(assetId: string): void {
  validateOpaqueId(assetId, "assetId");
}

function validateOpaqueId(value: string, label: string): void {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(value)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
}

function normalizeChecksum(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error("Checksum must be lowercase SHA-256 hex.");
  }
  return normalized;
}

async function verifyOrCalculateChecksum(
  path: string,
  expected?: string,
): Promise<string> {
  const expectedChecksum = normalizeChecksum(expected);
  const actual = await sha256File(path);
  if (expectedChecksum && actual !== expectedChecksum) {
    throw new Error("Local file checksum does not match the expected asset checksum.");
  }
  return actual;
}

async function fileMatches(path: string, sizeBytes: number, checksumSha256: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile() && fileStat.size === sizeBytes && (await sha256File(path)) === checksumSha256;
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}

async function sha256File(path: string): Promise<string> {
  return await new Promise<string>((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });
}

function toManifestPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isPathInside(parent: string, candidate: string): boolean {
  const parentPath = resolve(parent);
  const candidatePath = resolve(candidate);
  const relativePath = relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function backupTimestamp(): string {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}

async function readBackupManifest(path: string): Promise<LocalProjectManifest> {
  const manifestPath = join(path, "project.manifest.json");
  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error("Backup manifest must be a regular file.");
  }
  const value = JSON.parse(await readFile(manifestPath, "utf8")) as Partial<LocalProjectManifest>;
  if (
    value.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
    typeof value.projectId !== "string" ||
    !PROJECT_ID_PATTERN.test(value.projectId) ||
    !value.assets ||
    !value.artifacts
  ) {
    throw new Error("Backup does not contain a supported NarrativeX project manifest.");
  }
  return value as LocalProjectManifest;
}

async function directorySize(path: string): Promise<number> {
  try {
    const rootStat = await lstat(path);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return 0;
    let total = 0;
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) total += await directorySize(child);
      else if (entry.isFile()) total += (await lstat(child)).size;
    }
    return total;
  } catch (error) {
    if (isMissingFile(error)) return 0;
    throw error;
  }
}

async function directChildrenSize(path: string, excludedDirectories: Set<string>): Promise<number> {
  try {
    const rootStat = await lstat(path);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return 0;
    let total = 0;
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      if (entry.isFile()) total += (await lstat(join(path, entry.name))).size;
      else if (entry.isDirectory()) total += await directorySize(join(path, entry.name));
    }
    return total;
  } catch (error) {
    if (isMissingFile(error)) return 0;
    throw error;
  }
}

function migrateManifestV1ToV2(value: { assets?: Record<string, LocalAssetManifestEntry>; artifacts?: Record<string, LocalArtifactManifestEntry> }, projectId: string): LocalProjectManifest {
  const now = new Date().toISOString();
  if (!value.assets || typeof value.assets !== "object" || !value.artifacts || typeof value.artifacts !== "object") throw new Error("Local project manifest v1 is invalid.");
  return { schemaVersion: MANIFEST_SCHEMA_VERSION, projectId, createdAt: now, updatedAt: now, assets: value.assets, artifacts: value.artifacts } as LocalProjectManifest;
}
