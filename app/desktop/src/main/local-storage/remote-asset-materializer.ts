import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ProjectStorage, LocalAssetKind } from "./project-storage";
import type { DesktopBackendApiService } from "../api/backend-api-service";

const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export interface RemoteAssetMaterializationInput {
  projectId: string;
  assetId: string;
}

export class RemoteAssetMaterializer {
  private readonly storage: ProjectStorage;
  private readonly backendApi: DesktopBackendApiService;

  constructor(
    storage: ProjectStorage,
    backendApi: DesktopBackendApiService,
  ) {
    this.storage = storage;
    this.backendApi = backendApi;
  }

  async materialize(input: RemoteAssetMaterializationInput) {
    validateInputId(input.projectId, PROJECT_ID_PATTERN, "projectId");
    validateInputId(input.assetId, OPAQUE_ID_PATTERN, "assetId");
    const asset = await this.getAsset(input.assetId);
    const kind = asset.type;
    if (kind === "OTHER") throw new Error("Remote asset type is not supported by Desktop materialization.");
    const download = await this.getDownload(input.assetId);
    const url = new URL(download.url);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) throw new Error("Remote asset URL must use HTTPS outside localhost.");
    if (url.username || url.password || url.hash) throw new Error("Remote asset URL contains unsupported credentials or fragment.");
    if (!Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0) throw new Error("Remote asset size is invalid.");
    if (!/^[0-9a-f]{64}$/i.test(asset.sha256)) throw new Error("Remote asset checksum is invalid.");
    await this.storage.ensureProject(input.projectId);
    const temporaryPath = join(this.storage.projectDirectory(input.projectId), "work", `.remote-asset-${input.assetId}-${Date.now()}${safeExtension(download.filename)}`);
    try {
      const response = await fetch(url, { redirect: "error" });
      if (!response.ok || !response.body) throw new Error(`Remote asset download failed (${response.status}).`);
      if (new URL(response.url).origin !== url.origin) throw new Error("Remote asset download origin changed unexpectedly.");
      const declaredSize = response.headers.get("content-length");
      if (declaredSize && Number(declaredSize) !== asset.sizeBytes) throw new Error("Remote asset size does not match backend metadata.");
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType && asset.contentType && contentType !== asset.contentType.toLowerCase()) throw new Error("Remote asset content type does not match backend metadata.");
      let bytes = 0;
      const guard = new Transform({ transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; callback(bytes > asset.sizeBytes ? new Error("Remote asset exceeded expected size.") : null, chunk); } });
      await mkdir(join(this.storage.projectDirectory(input.projectId), "work"), { recursive: true });
      await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>), guard, createWriteStream(temporaryPath));
      if (bytes !== asset.sizeBytes) throw new Error("Remote asset byte count does not match backend metadata.");
      const checksum = await sha256File(temporaryPath);
      if (checksum !== asset.sha256.toLowerCase()) throw new Error("Remote asset checksum does not match backend metadata.");
      const registered = await this.storage.registerAsset(input.projectId, { assetId: input.assetId, kind, sourcePath: temporaryPath, checksumSha256: checksum });
      return { assetId: registered.assetId, kind: registered.kind, relativePath: registered.relativePath, sizeBytes: registered.sizeBytes, checksumSha256: registered.checksumSha256 };
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  private async getAsset(assetId: string): Promise<{ id: string; type: LocalAssetKind; contentType: string; sizeBytes: number; sha256: string }> {
    const response = await this.backendApi.request({ path: `/api/v1/assets/${encodeURIComponent(assetId)}` });
    const data = parseApiData(response.status, response.bodyText);
    if (!isRecord(data) || data.id !== assetId || typeof data.type !== "string" || typeof data.contentType !== "string" || typeof data.sizeBytes !== "number" || typeof data.sha256 !== "string") {
      throw new Error("Backend asset metadata is invalid or unavailable.");
    }
    if (!["IMAGE", "AUDIO", "VIDEO", "OTHER"].includes(data.type)) throw new Error("Backend asset type is invalid.");
    if (data.status !== "READY") throw new Error("Remote asset is not ready for download.");
    return { id: data.id, type: data.type as LocalAssetKind, contentType: data.contentType, sizeBytes: data.sizeBytes, sha256: data.sha256 };
  }

  private async getDownload(assetId: string): Promise<{ url: string; filename: string }> {
    const response = await this.backendApi.request({ path: `/api/v1/assets/${encodeURIComponent(assetId)}/download-url` });
    const data = parseApiData(response.status, response.bodyText);
    if (!isRecord(data) || typeof data.url !== "string" || typeof data.filename !== "string") throw new Error("Backend asset download metadata is invalid.");
    return { url: data.url, filename: data.filename };
  }
}

async function sha256File(path: string): Promise<string> { return await new Promise((resolvePromise, reject) => { const hash = createHash("sha256"); const stream = createReadStream(path); stream.on("error", reject); stream.on("data", (chunk) => hash.update(chunk)); stream.on("end", () => resolvePromise(hash.digest("hex"))); }); }
function safeExtension(filename: string): string { const extension = extname(basename(filename)).toLowerCase(); return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ".bin"; }
function isLoopbackHost(hostname: string): boolean { return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"; }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

function validateInputId(value: string, pattern: RegExp, label: string): void {
  if (!pattern.test(value)) throw new Error(`${label} contains unsupported characters.`);
}

function parseApiData(status: number, bodyText: string): unknown {
  if (status < 200 || status >= 300) throw new Error(`Backend asset request failed (${status}).`);
  let envelope: unknown;
  try { envelope = JSON.parse(bodyText); } catch { throw new Error("Backend asset response is not valid JSON."); }
  if (!isRecord(envelope) || envelope.success !== true || !("data" in envelope)) throw new Error("Backend asset response is invalid.");
  return envelope.data;
}
