import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DOWNLOAD_TIMEOUT_MS = 60_000;
const DOWNLOAD_REVEAL_TIMEOUT_MS = 4_000;
const MAX_RECOVERED_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const DOWNLOAD_WORDS = [
  "download full size",
  "download image",
  "download",
  "save image",
  "tải xuống",
  "tải hình ảnh",
  "tải ảnh",
  "lưu ảnh",
];
const MORE_ACTION_WORDS = [
  "more actions",
  "more options",
  "image options",
  "response actions",
  "thêm tùy chọn",
  "thêm tuỳ chọn",
];
const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="option"]',
  "[aria-label]",
  "[title]",
  "[data-tooltip]",
  "[data-tooltip-text]",
  "[data-test-id]",
  "[data-testid]",
].join(", ");

type DevToolsTarget = {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type CdpEnvelope = {
  id?: number;
  result?: unknown;
  error?: { message?: string };
};

type GeneratedImageTarget = {
  source: string;
  x: number;
  y: number;
};

type PageResource = {
  url: string;
  mimeType?: string;
  type?: string;
};

type PageResourceFrame = {
  frame: { id: string };
  resources?: PageResource[];
  childFrames?: PageResourceFrame[];
};

type PageResourceTree = {
  frameTree: PageResourceFrame;
};

class RecoveryCdpClient {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let message: CdpEnvelope;
      try {
        message = JSON.parse(event.data) as CdpEnvelope;
      } catch {
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
        waiter.reject(new Error("Chrome DevTools connection closed during Gemini download recovery."));
      }
      this.pending.clear();
    });
  }

  static async connect(url: string): Promise<RecoveryCdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Unable to reconnect to Chrome DevTools for Gemini download recovery."));
      };
      const cleanup = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });
    return new RecoveryCdpClient(socket);
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chrome DevTools connection is not open during Gemini download recovery.");
    }
    const id = this.nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return (await result) as T;
  }

  close(): void {
    this.socket.close();
  }
}

export function isGeminiDownloadRecoveryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "GEMINI_DOWNLOAD_CONTROL_NOT_FOUND" ||
    error.name === "GEMINI_DOWNLOAD_FAILED" ||
    error.message.includes("GEMINI_DOWNLOAD_CONTROL_NOT_FOUND") ||
    error.message.includes("GEMINI_DOWNLOAD_FAILED")
  );
}

export function imageExtensionForMimeType(contentType: string | null | undefined): string | null {
  const normalized = contentType?.split(";", 1)[0]?.trim().toLowerCase();
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

export async function recoverGeminiWebImageDownload(rootDirectory: string): Promise<string> {
  const sessionFile = join(rootDirectory, "session.json");
  const downloadDirectory = join(rootDirectory, "downloads");
  await mkdir(downloadDirectory, { recursive: true });

  const port = await readDebugPort(sessionFile);
  const page = await findGeminiTarget(port);
  const cdp = await RecoveryCdpClient.connect(page.webSocketDebuggerUrl as string);
  try {
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDirectory,
    });

    const before = await snapshotDownloads(downloadDirectory);
    let target = await revealGeneratedImage(cdp);
    if (!target) {
      throw recoveryError(
        "GEMINI_RECOVERY_IMAGE_NOT_FOUND",
        "Gemini generation finished, but the recovery path could not locate the generated image.",
      );
    }

    await hoverTarget(cdp, target);
    if (await waitAndClickDownloadControl(cdp, target)) {
      return waitForDownloadedImage(downloadDirectory, before);
    }

    await clickTarget(cdp, target);
    await delay(700);
    target = (await revealGeneratedImage(cdp)) ?? target;
    await hoverTarget(cdp, target);
    if (await waitAndClickDownloadControl(cdp, target)) {
      return waitForDownloadedImage(downloadDirectory, before);
    }

    if (await clickNearbyMoreActions(cdp, target)) {
      await delay(450);
      if (await waitAndClickDownloadControl(cdp, target)) {
        return waitForDownloadedImage(downloadDirectory, before);
      }
    }

    const recoveredPath = await persistGeneratedImageResource(
      cdp,
      target.source,
      downloadDirectory,
    );
    if (recoveredPath) return recoveredPath;

    const diagnostics = await interactiveDiagnostics(cdp, target);
    throw recoveryError(
      "GEMINI_DOWNLOAD_RECOVERY_FAILED",
      diagnostics
        ? `Gemini image is visible, but no usable download action or image resource was found. Nearby controls: ${diagnostics}`
        : "Gemini image is visible, but no usable download action or image resource was found.",
    );
  } finally {
    cdp.close();
  }
}

async function readDebugPort(sessionFile: string): Promise<number> {
  try {
    const parsed = JSON.parse(await readFile(sessionFile, "utf8")) as { port?: unknown };
    const port = Number(parsed.port);
    if (Number.isInteger(port) && port > 0) return port;
  } catch {
    // Use the stable recovery error below.
  }
  throw recoveryError(
    "GEMINI_RECOVERY_SESSION_MISSING",
    "NarrativeX could not reconnect to the Chrome session used for Gemini generation.",
  );
}

async function findGeminiTarget(port: number): Promise<DevToolsTarget> {
  const response = await fetch(`http://127.0.0.1:${port}/json`, {
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) {
    throw recoveryError(
      "GEMINI_RECOVERY_CHROME_UNAVAILABLE",
      `Chrome DevTools returned ${response.status} during Gemini download recovery.`,
    );
  }
  const targets = (await response.json()) as DevToolsTarget[];
  const target = targets.find(
    (candidate) =>
      candidate.type === "page" &&
      typeof candidate.url === "string" &&
      candidate.url.includes("gemini.google.com") &&
      typeof candidate.webSocketDebuggerUrl === "string",
  );
  if (!target?.webSocketDebuggerUrl) {
    throw recoveryError(
      "GEMINI_RECOVERY_TAB_UNAVAILABLE",
      "NarrativeX could not reconnect to the Gemini tab after generation.",
    );
  }
  return target;
}

async function revealGeneratedImage(cdp: RecoveryCdpClient): Promise<GeneratedImageTarget | null> {
  return evaluate<GeneratedImageTarget | null>(
    cdp,
    `(() => {
      const candidates = [...document.querySelectorAll('img')]
        .map((image, index) => ({ image, index }))
        .filter(({ image }) => image.naturalWidth >= 256 && image.naturalHeight >= 256)
        .map(({ image, index }) => {
          const rect = image.getBoundingClientRect();
          const style = window.getComputedStyle(image);
          const rendered = style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
          const label = String(image.getAttribute("alt") || "").toLowerCase();
          const source = image.currentSrc || image.src || "";
          const generatedHint = label.includes("generated") || label.includes("tạo") || source.includes("googleusercontent");
          const area = image.naturalWidth * image.naturalHeight;
          const score = area + (generatedHint ? 1_000_000_000 : 0) + index;
          return { image, source, rendered, score };
        })
        .filter((candidate) => candidate.rendered && candidate.source)
        .sort((a, b) => b.score - a.score);
      const target = candidates[0]?.image;
      if (!target) return null;
      target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const rect = target.getBoundingClientRect();
      return {
        source: target.currentSrc || target.src || "",
        x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
        y: Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
      };
    })()`,
  );
}

async function hoverTarget(cdp: RecoveryCdpClient, target: GeneratedImageTarget): Promise<void> {
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: target.x,
    y: target.y,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: target.x + 1,
    y: target.y + 1,
  });
  await delay(350);
}

async function clickTarget(cdp: RecoveryCdpClient, target: GeneratedImageTarget): Promise<void> {
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: target.x,
    y: target.y,
    button: "left",
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: target.x,
    y: target.y,
    button: "left",
    clickCount: 1,
  });
}

async function waitAndClickDownloadControl(
  cdp: RecoveryCdpClient,
  target: GeneratedImageTarget,
): Promise<boolean> {
  const deadline = Date.now() + DOWNLOAD_REVEAL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await clickDownloadControl(cdp, target)) return true;
    await delay(300);
  }
  return false;
}

async function clickDownloadControl(
  cdp: RecoveryCdpClient,
  target: GeneratedImageTarget,
): Promise<boolean> {
  return evaluate<boolean>(
    cdp,
    `(() => {
      const words = ${JSON.stringify(DOWNLOAD_WORDS)};
      const selector = ${JSON.stringify(INTERACTIVE_SELECTOR)};
      const targetPoint = ${JSON.stringify({ x: target.x, y: target.y })};
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0 &&
          rect.width > 6 && rect.height > 6 && rect.bottom > 0 && rect.right > 0 &&
          rect.top < window.innerHeight && rect.left < window.innerWidth;
      };
      const labelFor = (element) => {
        const attributes = ["aria-label", "title", "data-tooltip", "data-tooltip-text", "data-test-id", "data-testid"]
          .map((name) => element.getAttribute(name) || "")
          .join(" ");
        const svgTitle = element.querySelector?.("svg title")?.textContent || "";
        const imageAlt = element.querySelector?.("img")?.getAttribute("alt") || "";
        return (attributes + " " + String(element.textContent || "") + " " + svgTitle + " " + imageAlt)
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      };
      const controls = [...document.querySelectorAll(selector)]
        .filter((element) => visible(element))
        .filter((element) => words.some((word) => labelFor(element).includes(word)))
        .map((element) => {
          const clickable = element.closest?.('button, a, [role="button"], [role="menuitem"], [role="option"]') || element;
          const rect = clickable.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - targetPoint.x;
          const dy = rect.top + rect.height / 2 - targetPoint.y;
          return { clickable, distance: Math.sqrt(dx * dx + dy * dy) };
        })
        .sort((a, b) => a.distance - b.distance);
      const targetControl = controls[0]?.clickable;
      if (!targetControl) return false;
      if ("disabled" in targetControl && targetControl.disabled) return false;
      targetControl.click();
      return true;
    })()`,
  );
}

async function clickNearbyMoreActions(
  cdp: RecoveryCdpClient,
  target: GeneratedImageTarget,
): Promise<boolean> {
  return evaluate<boolean>(
    cdp,
    `(() => {
      const words = ${JSON.stringify(MORE_ACTION_WORDS)};
      const selector = ${JSON.stringify(INTERACTIVE_SELECTOR)};
      const targetPoint = ${JSON.stringify({ x: target.x, y: target.y })};
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 6 && rect.height > 6 &&
          rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
      };
      const labelFor = (element) => {
        const attributes = ["aria-label", "title", "data-tooltip", "data-tooltip-text", "data-test-id", "data-testid"]
          .map((name) => element.getAttribute(name) || "")
          .join(" ");
        return (attributes + " " + String(element.textContent || ""))
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      };
      const controls = [...document.querySelectorAll(selector)]
        .filter((element) => visible(element))
        .filter((element) => words.some((word) => labelFor(element).includes(word)))
        .map((element) => {
          const clickable = element.closest?.('button, [role="button"]') || element;
          const rect = clickable.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - targetPoint.x;
          const dy = rect.top + rect.height / 2 - targetPoint.y;
          return { clickable, distance: Math.sqrt(dx * dx + dy * dy) };
        })
        .filter((candidate) => candidate.distance < Math.max(window.innerWidth, window.innerHeight))
        .sort((a, b) => a.distance - b.distance);
      const action = controls[0]?.clickable;
      if (!action) return false;
      action.click();
      return true;
    })()`,
  );
}

async function persistGeneratedImageResource(
  cdp: RecoveryCdpClient,
  source: string,
  downloadDirectory: string,
): Promise<string | null> {
  const dataUrl = decodeImageDataUrl(source);
  if (dataUrl) {
    return writeRecoveredImage(downloadDirectory, dataUrl.bytes, dataUrl.contentType, source);
  }

  const fromResourceTree = await readImageFromResourceTree(cdp, source);
  if (fromResourceTree) {
    const path = await writeRecoveredImage(
      downloadDirectory,
      fromResourceTree.bytes,
      fromResourceTree.contentType,
      source,
    );
    if (path) return path;
  }

  const fromPageFetch = await readImageWithPageFetch(cdp, source);
  if (!fromPageFetch) return null;
  return writeRecoveredImage(
    downloadDirectory,
    fromPageFetch.bytes,
    fromPageFetch.contentType,
    source,
  );
}

function decodeImageDataUrl(source: string): { bytes: Buffer; contentType: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(source);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_RECOVERED_IMAGE_BYTES) return null;
  return { bytes, contentType: match[1] };
}

async function readImageFromResourceTree(
  cdp: RecoveryCdpClient,
  source: string,
): Promise<{ bytes: Buffer; contentType: string | null } | null> {
  try {
    const tree = await cdp.send<PageResourceTree>("Page.getResourceTree");
    const match = findResource(tree.frameTree, source);
    if (!match) return null;
    const content = await cdp.send<{ content: string; base64Encoded?: boolean }>(
      "Page.getResourceContent",
      { frameId: match.frameId, url: match.resource.url },
    );
    if (!content.base64Encoded) return null;
    const bytes = Buffer.from(content.content, "base64");
    if (!bytes.length || bytes.length > MAX_RECOVERED_IMAGE_BYTES) return null;
    return { bytes, contentType: match.resource.mimeType ?? null };
  } catch {
    return null;
  }
}

function findResource(
  frameTree: PageResourceFrame,
  source: string,
): { frameId: string; resource: PageResource } | null {
  const resource = frameTree.resources?.find((candidate) => candidate.url === source);
  if (resource) return { frameId: frameTree.frame.id, resource };
  for (const child of frameTree.childFrames ?? []) {
    const nested = findResource(child, source);
    if (nested) return nested;
  }
  return null;
}

async function readImageWithPageFetch(
  cdp: RecoveryCdpClient,
  source: string,
): Promise<{ bytes: Buffer; contentType: string | null } | null> {
  const result = await evaluate<{ contentBase64: string; contentType: string | null } | null>(
    cdp,
    `(async () => {
      try {
        const response = await fetch(${JSON.stringify(source)}, { credentials: "include" });
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size <= 0 || blob.size > ${MAX_RECOVERED_IMAGE_BYTES}) {
          return null;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
        }
        return { contentBase64: btoa(binary), contentType: blob.type || null };
      } catch {
        return null;
      }
    })()`,
  );
  if (!result?.contentBase64) return null;
  const bytes = Buffer.from(result.contentBase64, "base64");
  if (!bytes.length || bytes.length > MAX_RECOVERED_IMAGE_BYTES) return null;
  return { bytes, contentType: result.contentType };
}

async function writeRecoveredImage(
  downloadDirectory: string,
  bytes: Buffer,
  contentType: string | null,
  source: string,
): Promise<string | null> {
  if (!bytes.length || bytes.length > MAX_RECOVERED_IMAGE_BYTES) return null;
  const extension = imageExtensionForMimeType(contentType) ?? imageExtensionForSource(source);
  if (!extension) return null;
  const targetPath = join(
    downloadDirectory,
    `gemini-recovered-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}${extension}`,
  );
  await writeFile(targetPath, bytes);
  return targetPath;
}

function imageExtensionForSource(source: string): string | null {
  try {
    const extension = extname(new URL(source).pathname).toLowerCase();
    return IMAGE_EXTENSIONS.has(extension) ? extension : null;
  } catch {
    const extension = extname(source).toLowerCase();
    return IMAGE_EXTENSIONS.has(extension) ? extension : null;
  }
}

async function interactiveDiagnostics(
  cdp: RecoveryCdpClient,
  target: GeneratedImageTarget,
): Promise<string> {
  return evaluate<string>(
    cdp,
    `(() => {
      const selector = ${JSON.stringify(INTERACTIVE_SELECTOR)};
      const targetPoint = ${JSON.stringify({ x: target.x, y: target.y })};
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 6 && rect.height > 6 &&
          rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
      };
      return [...document.querySelectorAll(selector)]
        .filter((element) => visible(element))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - targetPoint.x;
          const dy = rect.top + rect.height / 2 - targetPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const label = ["aria-label", "title", "data-tooltip", "data-tooltip-text", "data-test-id", "data-testid"]
            .map((name) => element.getAttribute(name) || "")
            .join(" ") + " " + String(element.textContent || "");
          return { distance, label: label.replace(/\\s+/g, " ").trim() };
        })
        .filter((entry) => entry.label)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 8)
        .map((entry) => entry.label.slice(0, 100))
        .join(" | ");
    })()`,
  );
}

async function snapshotDownloads(downloadDirectory: string): Promise<Set<string>> {
  const entries = await readdir(downloadDirectory, { withFileTypes: true });
  return new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
}

async function waitForDownloadedImage(
  downloadDirectory: string,
  before: Set<string>,
): Promise<string> {
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  let stablePath: string | null = null;
  let stableSize = -1;
  while (Date.now() < deadline) {
    const entries = await readdir(downloadDirectory, { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isFile() && !before.has(entry.name))
      .map((entry) => join(downloadDirectory, entry.name));
    for (const candidate of candidates) {
      const extension = extname(candidate).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension) || candidate.endsWith(".crdownload")) continue;
      const file = await stat(candidate);
      if (!file.isFile() || file.size <= 0) continue;
      if (candidate === stablePath && file.size === stableSize) return candidate;
      stablePath = candidate;
      stableSize = file.size;
    }
    await delay(400);
  }
  throw recoveryError(
    "GEMINI_DOWNLOAD_RECOVERY_TIMEOUT",
    "Gemini download recovery clicked a download action, but no complete image file appeared.",
  );
}

async function evaluate<T>(cdp: RecoveryCdpClient, expression: string): Promise<T> {
  const response = await cdp.send<{
    result?: { value?: T; description?: string };
    exceptionDetails?: unknown;
  }>("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.result?.description || "Gemini recovery page script failed.");
  }
  return response.result?.value as T;
}

function recoveryError(code: string, message: string): Error {
  const error = new Error(`[${code}] ${message}`);
  error.name = code;
  return error;
}
