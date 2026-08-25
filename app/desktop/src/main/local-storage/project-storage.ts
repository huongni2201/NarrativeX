import { createHash } from "node:crypto";
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
  projectDirectory: string;
  totalBytes: number;
  assetBytes: number;
  artifactBytes: number;
  workBytes: number;
  cacheBytes: number;
  backupBytes: number;
  assetCount: number;
  artifactCount: number;
}

export interface LocalProjectBackup {
  projectId: string;
  backupDirectory: string;
  manifestSchemaVersion: number;
  createdAt: string;
  sizeBytes: number;
}

export interface LocalProjectRestoreInput {
  backupDirectory: string;
  replaceExisting?: boolean;
}

export interface LocalProjectRestoreResult {
  projectId: string;
  projectDirectory: string;
  previousProjectDirectory: string | null;
  restoredFrom: string;
}

export interface LocalProjectArchiveResult {
  projectId: string;
  archiveDirectory: string;
}

export class ProjectStorage {
  private readonly projectLocks = new Map<string, Promise<void>>();
  private readonly projectsRoot: string;

  constructor(projectsRoot: string) {
    this.projectsRoot = projectsRoot;
  }

  rootDirectory(): string { return this.projectsRoot; }

  async ensureProject(projectId: string): Promise<LocalProjectManifest> {
    return this.withProjectLock(projectId, async () => {
      const root = this.projectRoot(projectId);
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

  projectDirectory(projectId: string): string {
    return this.projectRoot(projectId);
  }

  async storageSummary(projectId: string): Promise<LocalStorageSummary> {
    const manifest = await this.ensureProject(projectId);
    const root = this.projectRoot(projectId);
    const [assetBytes, artifactBytes, workBytes, cacheBytes, backupBytes] = await Promise.all([
      directorySize(join(root, "assets")),
      directorySize(join(root, "artifacts")),
      directorySize(join(root, "work")),
      directorySize(join(root, "cache")),
      directorySize(join(root, "backups")),
    ]);
    return { projectId, projectDirectory: root, totalBytes: assetBytes + artifactBytes + workBytes + cacheBytes + backupBytes, assetBytes, artifactBytes, workBytes, cacheBytes, backupBytes, assetCount: Object.keys(manifest.assets).length, artifactCount: Object.keys(manifest.artifacts).length };
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
        if (journal.stage === "COMPLETED" || journal.stage === "FAILED") {
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
      const destinationRoot = resolve(destinationDirectory);
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
        await readBackupManifest(backupDirectory);
        return {
          projectId: manifest.projectId,
          backupDirectory,
          manifestSchemaVersion: manifest.schemaVersion,
          createdAt: new Date().toISOString(),
          sizeBytes: await directorySize(backupDirectory),
        };
      } catch (error) {
        await rm(backupDirectory, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
    });
  }

  async restoreBackup(input: LocalProjectRestoreInput): Promise<LocalProjectRestoreResult> {
    const backupDirectory = resolve(input.backupDirectory);
    const backupManifest = await readBackupManifest(backupDirectory);
    const projectId = backupManifest.projectId;
    return this.withProjectLock(projectId, async () => {
      const destination = this.projectRoot(projectId);
      const activeProjectDirectory = await directoryExists(destination) ? destination : null;
      if (activeProjectDirectory && !input.replaceExisting) {
        throw new Error(`Project ${projectId} already exists. Confirm replacement before restoring.`);
      }
      if (isPathInside(destination, backupDirectory)) {
        throw new Error("Restore source must be outside the active project workspace.");
      }

      const staging = join(resolve(this.projectsRoot), `.restore-${projectId}-${process.pid}-${Date.now()}`);
      await cp(backupDirectory, staging, { recursive: true, errorOnExist: true });
      let preservedPreviousDirectory: string | null = null;
      try {
        if (activeProjectDirectory) {
          preservedPreviousDirectory = `${destination}.before-restore-${Date.now()}`;
          await rename(destination, preservedPreviousDirectory);
        }
        await rename(staging, destination);
      } catch (error) {
        await rm(staging, { recursive: true, force: true }).catch(() => undefined);
        if (preservedPreviousDirectory && !(await directoryExists(destination))) {
          await rename(preservedPreviousDirectory, destination).catch(() => undefined);
        }
        throw error;
      }
      return { projectId, projectDirectory: destination, previousProjectDirectory: preservedPreviousDirectory, restoredFrom: backupDirectory };
    });
  }

  async archiveProject(projectId: string, destinationDirectory: string): Promise<LocalProjectArchiveResult> {
    await this.ensureProject(projectId);
    return this.withProjectLock(projectId, async () => {
      const source = this.projectRoot(projectId);
      const destinationRoot = resolve(destinationDirectory);
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
        return { projectId, archiveDirectory };
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
    let total = 0;
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) total += await directorySize(child);
      else if (entry.isFile()) total += (await stat(child)).size;
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
