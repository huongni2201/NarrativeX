import { net, protocol, type Protocol } from "electron";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import {
  LOCAL_ASSET_PREVIEW_SCHEME,
  parseLocalAssetPreviewUrl,
} from "../../shared/local-asset-preview-url";
import type { ProjectStorage } from "./project-storage";

const MAX_WARNED_ASSETS = 1_000;

/** Must run before Electron's ready event. */
export function registerLocalAssetPreviewScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_ASSET_PREVIEW_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function installLocalAssetPreviewProtocol(
  targetProtocol: Protocol,
  storage: ProjectStorage,
): void {
  // Concurrent requests for one asset revision share a single resolve. Integrity itself is cached
  // by file stat inside the storage layer (fast mode), so there is no time-based expiry here.
  const resolving = new Map<string, Promise<string>>();
  const warnedAssets = new Set<string>();

  targetProtocol.handle(LOCAL_ASSET_PREVIEW_SCHEME, async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    const target = parseLocalAssetPreviewUrl(request.url);
    if (!target) return new Response("Invalid preview URL", { status: 400 });

    try {
      const revision = new URL(request.url).search;
      const key = `${target.projectId}:${target.assetId}:${revision}`;
      let pending = resolving.get(key);
      if (!pending) {
        pending = storage
          .resolveAsset(target.projectId, target.assetId, undefined, "fast")
          .finally(() => resolving.delete(key));
        resolving.set(key, pending);
      }
      let localPath: string;
      try {
        localPath = await pending;
      } catch (error) {
        warnOnce(warnedAssets, `${target.projectId}:${target.assetId}`, error);
        throw error;
      }

      const headers = new Headers();
      const range = request.headers.get("range");
      if (range) headers.set("Range", range);
      const upstream = await net.fetch(pathToFileURL(localPath).toString(), {
        method: request.method,
        headers,
      });
      const responseHeaders = new Headers(upstream.headers);
      if (!responseHeaders.has("Content-Type")) {
        responseHeaders.set("Content-Type", contentTypeForPath(localPath));
      }
      responseHeaders.set("Cache-Control", "private, max-age=60");
      responseHeaders.set("X-Content-Type-Options", "nosniff");
      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch {
      return new Response("Local preview asset unavailable", { status: 404 });
    }
  });
}

function warnOnce(warned: Set<string>, assetKey: string, error: unknown): void {
  if (warned.has(assetKey)) return;
  if (warned.size >= MAX_WARNED_ASSETS) warned.clear();
  warned.add(assetKey);
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`Local preview asset ${assetKey} unavailable: ${reason}`);
}

function contentTypeForPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}
