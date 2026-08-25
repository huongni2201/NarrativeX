import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ProjectStorage, LocalAssetKind } from "./project-storage";

export interface RemoteAssetMaterializationInput {
  projectId: string;
  assetId: string;
  kind: Exclude<LocalAssetKind, "OTHER">;
  downloadUrl: string;
  sizeBytes: number;
  checksumSha256: string;
  filename: string;
}

export class RemoteAssetMaterializer {
  constructor(private readonly storage: ProjectStorage) {}

  async materialize(input: RemoteAssetMaterializationInput) {
    const url = new URL(input.downloadUrl);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) throw new Error("Remote asset URL must use HTTPS outside localhost.");
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) throw new Error("Remote asset size is invalid.");
    if (!/^[0-9a-f]{64}$/i.test(input.checksumSha256)) throw new Error("Remote asset checksum is invalid.");
    await this.storage.ensureProject(input.projectId);
    const temporaryPath = join(this.storage.projectDirectory(input.projectId), "work", `.remote-asset-${input.assetId}-${Date.now()}${safeExtension(input.filename)}`);
    try {
      const response = await fetch(url, { redirect: "error" });
      if (!response.ok || !response.body) throw new Error(`Remote asset download failed (${response.status}).`);
      const declaredSize = response.headers.get("content-length");
      if (declaredSize && Number(declaredSize) !== input.sizeBytes) throw new Error("Remote asset size does not match backend metadata.");
      let bytes = 0;
      const guard = new Transform({ transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; callback(bytes > input.sizeBytes ? new Error("Remote asset exceeded expected size.") : null, chunk); } });
      await mkdir(join(this.storage.projectDirectory(input.projectId), "work"), { recursive: true });
      await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>), guard, createWriteStream(temporaryPath));
      if (bytes !== input.sizeBytes) throw new Error("Remote asset byte count does not match backend metadata.");
      const checksum = await sha256File(temporaryPath);
      if (checksum !== input.checksumSha256.toLowerCase()) throw new Error("Remote asset checksum does not match backend metadata.");
      const registered = await this.storage.registerAsset(input.projectId, { assetId: input.assetId, kind: input.kind, sourcePath: temporaryPath, checksumSha256: checksum });
      return { assetId: registered.assetId, kind: registered.kind, relativePath: registered.relativePath, sizeBytes: registered.sizeBytes, checksumSha256: registered.checksumSha256 };
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function sha256File(path: string): Promise<string> { return await new Promise((resolvePromise, reject) => { const hash = createHash("sha256"); const stream = createReadStream(path); stream.on("error", reject); stream.on("data", (chunk) => hash.update(chunk)); stream.on("end", () => resolvePromise(hash.digest("hex"))); }); }
function safeExtension(filename: string): string { const extension = extname(basename(filename)).toLowerCase(); return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ".bin"; }
function isLoopbackHost(hostname: string): boolean { return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"; }
