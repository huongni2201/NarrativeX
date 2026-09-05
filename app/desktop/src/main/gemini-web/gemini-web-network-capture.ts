import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const SESSION_CONNECT_TIMEOUT_MS = 30_000;
const CAPTURE_TIMEOUT_MS = 5 * 60_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export type GeminiNetworkCaptureResult = {
  sourcePath: string;
  url: string;
  mimeType: string;
  encodedDataLength: number;
};

type DevToolsTarget = {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type CdpEnvelope = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
};

type NetworkResponseReceivedEvent = {
  requestId: string;
  type?: string;
  response?: {
    url?: string;
    status?: number;
    mimeType?: string;
  };
};

type NetworkLoadingFinishedEvent = {
  requestId: string;
  encodedDataLength?: number;
};

type NetworkCandidate = {
  requestId: string;
  url: string;
  mimeType: string;
  encodedDataLength: number;
  seenAt: number;
  finishedAt: number | null;
};

type ResponseBody = {
  body?: string;
  base64Encoded?: boolean;
};

type DomImage = {
  src: string;
  area: number;
};

class CdpEventClient {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly listeners = new Map<string, Set<(params: unknown) => void>>();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let message: CdpEnvelope;
      try {
        message = JSON.parse(event.data) as CdpEnvelope;
      } catch {
        return;
      }

      if (typeof message.method === "string" && typeof message.id !== "number") {
        for (const listener of this.listeners.get(message.method) ?? []) {
          try {
            listener(message.params);
          } catch {
            // One observer must never break the CDP transport.
          }
        }
        return;
      }

      if (typeof message.id !== "number") return;
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(message.error.message || "Chrome DevTools command failed."));
        return;
      }
      waiter.resolve(message.result);
    });

    this.socket.addEventListener("close", () => {
      for (const waiter of this.pending.values()) {
        waiter.reject(new Error("Chrome DevTools connection closed during Gemini network capture."));
      }
      this.pending.clear();
      this.listeners.clear();
    });
  }

  static async connect(url: string): Promise<CdpEventClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Unable to connect to Chrome DevTools for Gemini network capture."));
      };
      const cleanup = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });
    return new CdpEventClient(socket);
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chrome DevTools connection is not open during Gemini network capture.");
    }
    const id = this.nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return (await result) as T;
  }

  on<T>(method: string, listener: (params: T) => void): () => void {
    const listeners = this.listeners.get(method) ?? new Set<(params: unknown) => void>();
    const wrapped = listener as (params: unknown) => void;
    listeners.add(wrapped);
    this.listeners.set(method, listeners);
    return () => {
      const current = this.listeners.get(method);
      current?.delete(wrapped);
      if (current?.size === 0) this.listeners.delete(method);
    };
  }

  close(): void {
    this.socket.close();
  }
}

export class GeminiWebNetworkCapture {
  private cancelled = false;

  constructor(private readonly rootDirectory: string) {}

  cancel(): void {
    this.cancelled = true;
  }

  async captureNextGeneratedImage(): Promise<GeminiNetworkCaptureResult | null> {
    const sessionFile = join(this.rootDirectory, "session.json");
    const downloadDirectory = join(this.rootDirectory, "downloads");
    await mkdir(downloadDirectory, { recursive: true });

    const target = await this.waitForGeminiTarget(sessionFile);
    if (!target?.webSocketDebuggerUrl || this.cancelled) return null;

    const cdp = await CdpEventClient.connect(target.webSocketDebuggerUrl);
    const candidates = new Map<string, NetworkCandidate>();
    const startedAt = Date.now();
    const baselineSources = new Set<string>();
    const unsubscribe: Array<() => void> = [];

    try {
      await cdp.send("Runtime.enable");
      await cdp.send("Network.enable", {
        maxTotalBufferSize: 100 * 1024 * 1024,
        maxResourceBufferSize: 25 * 1024 * 1024,
      });

      for (const image of await this.readDomImages(cdp)) baselineSources.add(normalizeUrl(image.src));

      unsubscribe.push(
        cdp.on<NetworkResponseReceivedEvent>("Network.responseReceived", (event) => {
          const response = event?.response;
          const mimeType = response?.mimeType?.toLowerCase() ?? "";
          const url = response?.url ?? "";
          const status = response?.status ?? 0;
          if (!event?.requestId || !mimeType.startsWith("image/") || !url) return;
          if (status < 200 || status >= 400) return;
          candidates.set(event.requestId, {
            requestId: event.requestId,
            url,
            mimeType,
            encodedDataLength: 0,
            seenAt: Date.now(),
            finishedAt: null,
          });
        }),
      );

      unsubscribe.push(
        cdp.on<NetworkLoadingFinishedEvent>("Network.loadingFinished", (event) => {
          const candidate = candidates.get(event?.requestId);
          if (!candidate) return;
          candidate.encodedDataLength = Number(event.encodedDataLength ?? 0);
          candidate.finishedAt = Date.now();
        }),
      );

      const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
      while (!this.cancelled && Date.now() < deadline) {
        const domImages = await this.readDomImages(cdp);
        const freshDomImages = domImages.filter(
          (image) => !baselineSources.has(normalizeUrl(image.src)),
        );
        const candidate = selectBestNetworkCandidate(
          [...candidates.values()],
          freshDomImages,
          startedAt,
        );
        if (candidate) {
          const bytes = await readResponseBody(cdp, candidate.requestId);
          if (bytes && bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES) {
            const extension = imageExtensionForMimeType(candidate.mimeType) ?? imageExtensionForUrl(candidate.url);
            if (extension) {
              const sourcePath = join(
                downloadDirectory,
                `gemini-network-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}${extension}`,
              );
              await writeFile(sourcePath, bytes);
              const file = await stat(sourcePath);
              if (file.isFile() && file.size === bytes.length) {
                return {
                  sourcePath,
                  url: candidate.url,
                  mimeType: candidate.mimeType,
                  encodedDataLength: candidate.encodedDataLength || bytes.length,
                };
              }
            }
          }
          candidates.delete(candidate.requestId);
        }
        await delay(250);
      }
      return null;
    } finally {
      for (const dispose of unsubscribe) dispose();
      cdp.close();
    }
  }

  private async waitForGeminiTarget(sessionFile: string): Promise<DevToolsTarget | null> {
    const deadline = Date.now() + SESSION_CONNECT_TIMEOUT_MS;
    while (!this.cancelled && Date.now() < deadline) {
      const port = await readPersistedPort(sessionFile);
      if (port) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/json`, {
            signal: AbortSignal.timeout(1_500),
          });
          if (response.ok) {
            const targets = (await response.json()) as DevToolsTarget[];
            const target = targets.find(
              (candidate) =>
                candidate.type === "page" &&
                typeof candidate.url === "string" &&
                candidate.url.includes("gemini.google.com") &&
                typeof candidate.webSocketDebuggerUrl === "string",
            );
            if (target?.webSocketDebuggerUrl) return target;
          }
        } catch {
          // Chrome may still be starting. Retry until the short connection deadline.
        }
      }
      await delay(100);
    }
    return null;
  }

  private async readDomImages(cdp: CdpEventClient): Promise<DomImage[]> {
    try {
      return await evaluate<DomImage[]>(
        cdp,
        `(() => [...document.querySelectorAll('img')]
          .filter((image) => {
            const style = window.getComputedStyle(image);
            const rect = image.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" &&
              rect.width >= 128 && rect.height >= 128 &&
              image.naturalWidth >= 256 && image.naturalHeight >= 256;
          })
          .map((image) => ({
            src: image.currentSrc || image.src || "",
            area: image.naturalWidth * image.naturalHeight,
          }))
          .filter((image) => image.src))()`,
      );
    } catch {
      return [];
    }
  }
}

export function selectBestNetworkCandidate(
  candidates: NetworkCandidate[],
  freshDomImages: DomImage[],
  startedAt: number,
): NetworkCandidate | null {
  const domUrls = new Set(freshDomImages.map((image) => normalizeUrl(image.src)));
  const freshDomHosts = new Set(
    freshDomImages.map((image) => hostForUrl(image.src)).filter((value): value is string => Boolean(value)),
  );

  const eligible = candidates.filter((candidate) => {
    if (!candidate.finishedAt || candidate.seenAt < startedAt) return false;
    return imageExtensionForMimeType(candidate.mimeType) !== null;
  });
  if (!eligible.length) return null;

  eligible.sort((a, b) => {
    const scoreA = scoreCandidate(a, domUrls, freshDomHosts);
    const scoreB = scoreCandidate(b, domUrls, freshDomHosts);
    return scoreB - scoreA;
  });

  const best = eligible[0];
  const exactDomMatch = domUrls.has(normalizeUrl(best.url));
  const hostMatch = freshDomHosts.has(hostForUrl(best.url) ?? "");
  const sufficientlyLarge = best.encodedDataLength >= 100 * 1024;
  return exactDomMatch || (freshDomImages.length > 0 && hostMatch && sufficientlyLarge) ? best : null;
}

export function imageExtensionForMimeType(mimeType: string | null | undefined): string | null {
  const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  switch (normalized) {
    case "image/png":
      return ".png";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return null;
  }
}

function scoreCandidate(
  candidate: NetworkCandidate,
  domUrls: Set<string>,
  domHosts: Set<string>,
): number {
  let score = Math.min(candidate.encodedDataLength, 25 * 1024 * 1024);
  const normalized = normalizeUrl(candidate.url);
  if (domUrls.has(normalized)) score += 1_000_000_000;
  const host = hostForUrl(candidate.url);
  if (host && domHosts.has(host)) score += 100_000_000;
  if (candidate.url.includes("googleusercontent")) score += 50_000_000;
  if (candidate.mimeType === "image/png") score += 10_000;
  return score;
}

async function readResponseBody(cdp: CdpEventClient, requestId: string): Promise<Buffer | null> {
  try {
    const result = await cdp.send<ResponseBody>("Network.getResponseBody", { requestId });
    if (typeof result.body !== "string" || !result.body) return null;
    const bytes = result.base64Encoded
      ? Buffer.from(result.body, "base64")
      : Buffer.from(result.body, "utf8");
    return bytes.length ? bytes : null;
  } catch {
    return null;
  }
}

async function readPersistedPort(sessionFile: string): Promise<number | null> {
  try {
    const parsed = JSON.parse(await readFile(sessionFile, "utf8")) as { port?: unknown };
    const port = Number(parsed.port);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function hostForUrl(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function imageExtensionForUrl(value: string): string | null {
  try {
    const extension = extname(new URL(value).pathname).toLowerCase();
    return IMAGE_EXTENSIONS.has(extension) ? extension : null;
  } catch {
    const extension = extname(value).toLowerCase();
    return IMAGE_EXTENSIONS.has(extension) ? extension : null;
  }
}

async function evaluate<T>(cdp: CdpEventClient, expression: string): Promise<T> {
  const response = await cdp.send<{
    result?: { value?: T; description?: string };
    exceptionDetails?: unknown;
  }>("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.result?.description || "Gemini network capture page script failed.");
  }
  return response.result?.value as T;
}
