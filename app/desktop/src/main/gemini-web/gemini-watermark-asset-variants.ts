import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";

const WATERMARK_INDEX_SCHEMA_VERSION = 1 as const;
const WATERMARK_INDEX_FILENAME = ".gemini-watermarks.json";
const VARIANT_DIRECTORY = join("assets", "images", ".watermark-removed");
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type GeminiWatermarkState = "PENDING" | "REMOVED" | "NOT_APPLICABLE";
type ResolveExpected = { sizeBytes?: number; checksumSha256?: string };
type AssetResolver = (projectId: string, assetId: string, expected?: ResolveExpected) => Promise<string>;
export interface GeminiWatermarkStorage { projectDirectory(projectId: string): string; resolveAsset: AssetResolver; }
interface WatermarkVariantRecord { relativePath: string; sizeBytes: number; checksumSha256: string; updatedAt: string; }
interface GeminiWatermarkRecord { source: "GEMINI_WEB"; markedAt: string; variant?: WatermarkVariantRecord; }
interface GeminiWatermarkIndex { schemaVersion: typeof WATERMARK_INDEX_SCHEMA_VERSION; assets: Record<string, GeminiWatermarkRecord>; }
const installations = new WeakMap<object, GeminiWatermarkAssetVariants>();

export function installGeminiWatermarkAssetVariants(storage: GeminiWatermarkStorage): GeminiWatermarkAssetVariants {
  const key = storage as object;
  const installed = installations.get(key);
  if (installed) return installed;
  const manager = new GeminiWatermarkAssetVariants(storage);
  installations.set(key, manager);
  manager.installPreferredResolution();
  return manager;
}

export class GeminiWatermarkAssetVariants {
  private readonly canonicalResolveAsset: AssetResolver;
  private readonly projectLocks = new Map<string, Promise<void>>();
  private installed = false;
  constructor(private readonly storage: GeminiWatermarkStorage) { this.canonicalResolveAsset = storage.resolveAsset.bind(storage); }

  installPreferredResolution(): void {
    if (this.installed) return;
    this.installed = true;
    this.storage.resolveAsset = (projectId, assetId, expected) => this.resolvePreferredAsset(projectId, assetId, expected);
  }

  async markGeminiAsset(projectId: string, assetId: string): Promise<void> {
    validateAssetId(assetId);
    await this.withProjectLock(projectId, async () => {
      const index = await this.readIndex(projectId);
      if (index.assets[assetId]) return;
      index.assets[assetId] = { source: "GEMINI_WEB", markedAt: new Date().toISOString() };
      await this.writeIndex(projectId, index);
    });
  }

  async watermarkStates(projectId: string, assetIds: readonly string[]): Promise<Record<string, GeminiWatermarkState>> {
    const index = await this.readIndex(projectId);
    const result: Record<string, GeminiWatermarkState> = {};
    for (const assetId of assetIds) {
      validateAssetId(assetId);
      const record = index.assets[assetId];
      if (!record) { result[assetId] = "NOT_APPLICABLE"; continue; }
      result[assetId] = record.variant && (await this.variantIsValid(projectId, record.variant)) ? "REMOVED" : "PENDING";
    }
    return result;
  }

  async registerRemovedVariant(projectId: string, assetId: string, sourcePath: string): Promise<WatermarkVariantRecord> {
    validateAssetId(assetId);
    const source = resolve(sourcePath);
    const sourceStat = await stat(source);
    if (!sourceStat.isFile() || sourceStat.size <= 0) throw new Error("Gemini watermark output must be a non-empty image file.");
    const extension = safeImageExtension(source);
    const checksumSha256 = await sha256File(source);
    const relativePath = join(VARIANT_DIRECTORY, `${assetId}-${checksumSha256.slice(0, 16)}${extension}`);
    const destination = this.resolveProjectRelativePath(projectId, relativePath);
    return this.withProjectLock(projectId, async () => {
      const index = await this.readIndex(projectId);
      const record = index.assets[assetId];
      if (!record) throw new Error(`Local asset ${assetId} is not tracked as a Gemini image.`);
      await mkdir(dirname(destination), { recursive: true });
      const alreadyValid = await fileMatches(destination, sourceStat.size, checksumSha256);
      if (!alreadyValid) await copyFile(source, destination);
      try {
        if (!(await fileMatches(destination, sourceStat.size, checksumSha256))) throw new Error("Gemini watermark variant changed while it was being saved.");
        const previous = record.variant;
        const variant: WatermarkVariantRecord = { relativePath: toManifestPath(relativePath), sizeBytes: sourceStat.size, checksumSha256, updatedAt: new Date().toISOString() };
        record.variant = variant;
        await this.writeIndex(projectId, index);
        if (previous && previous.relativePath !== variant.relativePath) await rm(this.resolveProjectRelativePath(projectId, previous.relativePath), { force: true }).catch(() => undefined);
        return variant;
      } catch (error) {
        if (!alreadyValid) await rm(destination, { force: true }).catch(() => undefined);
        throw error;
      }
    });
  }

  resolveCanonicalAsset(projectId: string, assetId: string, expected?: ResolveExpected): Promise<string> { return this.canonicalResolveAsset(projectId, assetId, expected); }

  private async resolvePreferredAsset(projectId: string, assetId: string, expected?: ResolveExpected): Promise<string> {
    const canonicalPath = await this.canonicalResolveAsset(projectId, assetId, expected);
    const index = await this.readIndex(projectId);
    const variant = index.assets[assetId]?.variant;
    if (!variant || !(await this.variantIsValid(projectId, variant))) return canonicalPath;
    return this.resolveProjectRelativePath(projectId, variant.relativePath);
  }

  private async variantIsValid(projectId: string, variant: WatermarkVariantRecord): Promise<boolean> {
    if (!variant.relativePath || !Number.isSafeInteger(variant.sizeBytes) || variant.sizeBytes <= 0 || !SHA256_PATTERN.test(variant.checksumSha256)) return false;
    try { return await fileMatches(this.resolveProjectRelativePath(projectId, variant.relativePath), variant.sizeBytes, variant.checksumSha256); } catch { return false; }
  }

  private indexPath(projectId: string): string { return join(this.storage.projectDirectory(projectId), "assets", WATERMARK_INDEX_FILENAME); }
  private async readIndex(projectId: string): Promise<GeminiWatermarkIndex> {
    const path = this.indexPath(projectId);
    try {
      const pathStat = await lstat(path);
      if (pathStat.isSymbolicLink() || !pathStat.isFile()) throw new Error("Gemini watermark index must be a regular file.");
      const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<GeminiWatermarkIndex>;
      if (parsed.schemaVersion !== WATERMARK_INDEX_SCHEMA_VERSION || !parsed.assets || typeof parsed.assets !== "object" || Array.isArray(parsed.assets)) throw new Error("Gemini watermark index is invalid or unsupported.");
      return parsed as GeminiWatermarkIndex;
    } catch (error) {
      if (isMissingFile(error)) return { schemaVersion: WATERMARK_INDEX_SCHEMA_VERSION, assets: {} };
      throw error;
    }
  }

  private async writeIndex(projectId: string, index: GeminiWatermarkIndex): Promise<void> {
    const destination = this.indexPath(projectId);
    await mkdir(dirname(destination), { recursive: true });
    try { const destinationStat = await lstat(destination); if (destinationStat.isSymbolicLink() || !destinationStat.isFile()) throw new Error("Gemini watermark index must be a regular file."); } catch (error) { if (!isMissingFile(error)) throw error; }
    const temporary = join(dirname(destination), `.${basename(destination)}.${process.pid}.${Date.now()}.tmp`);
    try { await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`, "utf8"); await rename(temporary, destination); }
    finally { await rm(temporary, { force: true }).catch(() => undefined); }
  }

  private resolveProjectRelativePath(projectId: string, relativePath: string): string {
    if (!relativePath || isAbsolute(relativePath)) throw new Error("Gemini watermark variant path must be relative.");
    const root = resolve(this.storage.projectDirectory(projectId));
    const candidate = resolve(root, normalize(relativePath));
    const rel = relative(root, candidate);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Gemini watermark variant path escapes the project workspace.");
    return candidate;
  }

  private async withProjectLock<T>(projectId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.projectLocks.get(projectId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    const queued = previous.then(() => current);
    this.projectLocks.set(projectId, queued);
    await previous;
    try { return await task(); } finally { release(); if (this.projectLocks.get(projectId) === queued) this.projectLocks.delete(projectId); }
  }
}

function validateAssetId(assetId: string): void { if (!OPAQUE_ID_PATTERN.test(assetId)) throw new Error("Invalid assetId for Gemini watermark metadata."); }
function safeImageExtension(path: string): string { const extension = extname(path).toLowerCase(); if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) throw new Error("Gemini watermark variant must be PNG, JPEG, or WebP."); return extension; }
function toManifestPath(path: string): string { return path.replaceAll("\\", "/"); }
async function fileMatches(path: string, sizeBytes: number, checksumSha256: string): Promise<boolean> { try { const file = await stat(path); return file.isFile() && file.size === sizeBytes && (await sha256File(path)) === checksumSha256; } catch (error) { if (isMissingFile(error)) return false; throw error; } }
async function sha256File(path: string): Promise<string> { const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest("hex"); }
function isMissingFile(error: unknown): boolean { return Boolean(error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"); }
