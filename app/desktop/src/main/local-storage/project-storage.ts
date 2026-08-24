import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
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

const MANIFEST_SCHEMA_VERSION = 1 as const;
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

export class ProjectStorage {
  private readonly projectLocks = new Map<string, Promise<void>>();

  constructor(private readonly projectsRoot: string) {}

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
      ]);
      const existing = await this.readManifest(projectId);
      if (existing) return existing;

      const manifest: LocalProjectManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        projectId,
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
      const parsed = JSON.parse(await readFile(path, "utf8")) as LocalProjectManifest;
      if (
        parsed.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
        parsed.projectId.toLowerCase() !== projectId.toLowerCase() ||
        typeof parsed.assets !== "object" ||
        typeof parsed.artifacts !== "object"
      ) {
        throw new Error("Local project manifest is invalid or unsupported.");
      }
      return parsed;
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
