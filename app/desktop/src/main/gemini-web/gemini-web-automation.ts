import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { delimiter, extname, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  imageExtensionForMimeType,
  selectBestNetworkCandidate,
} from "./gemini-web-network-capture";
import {
  findGeminiModelCandidateIndex,
  type GeminiModelCandidate,
} from "./gemini-web-model-selection";

const GEMINI_URL = "https://gemini.google.com/app";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const CHROME_START_TIMEOUT_MS = 20_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const GENERATION_TIMEOUT_MS = 4 * 60_000;
const GEMINI_IMAGE_MODEL = "Gemini 3.1 Pro";
const NETWORK_CAPTURE_GRACE_MS = 8_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const REFERENCE_UPLOAD_TIMEOUT_MS = 30_000;
const MIN_CAPTURE_BYTES = 24 * 1024;
const MAX_CAPTURE_BYTES = 20 * 1024 * 1024;
const GEMINI_MODEL_OPTION_SELECTOR =
  'button, [role="option"], [role="menuitem"], [role="menuitemradio"], [role="radio"]';

export interface GeminiWebGenerationResult {
  sourcePath: string;
  captureMethod: "NETWORK" | "DOWNLOAD";
}

export interface GeminiWebReferenceFile {
  path: string;
  refLabel: string;
  canonicalName: string;
  characterId: string;
  beatRole?: string | null;
}

type DevToolsVersion = {
  webSocketDebuggerUrl?: string;
};

type DevToolsTarget = {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type PersistedSession = {
  port: number;
};

type CdpEnvelope = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
};

type GenerationSnapshot = {
  downloadCount: number;
  imageSources: string[];
  blocked: boolean;
};

type NetworkCandidate = {
  requestId: string;
  url: string;
  mimeType: string;
  encodedDataLength: number;
  seenAt: number;
  finishedAt: number | null;
};

type NetworkResponseReceivedEvent = {
  requestId?: string;
  response?: { url?: string; status?: number; mimeType?: string };
};

type NetworkLoadingFinishedEvent = {
  requestId?: string;
  encodedDataLength?: number;
};

type ResponseBody = {
  body?: string;
  base64Encoded?: boolean;
};

type DomImage = {
  src: string;
  area: number;
};

class CdpClient {
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
            // A diagnostic/network observer must never break the CDP transport.
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
        waiter.reject(new Error("Chrome DevTools connection closed."));
      }
      this.pending.clear();
      this.listeners.clear();
    });
  }

  static async connect(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Unable to connect to Chrome DevTools."));
      };
      const cleanup = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });
    return new CdpClient(socket);
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chrome DevTools connection is not open.");
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

class NetworkImageTracker {
  private readonly candidates = new Map<string, NetworkCandidate>();
  private readonly unsubscribe: Array<() => void> = [];
  private startedAt = 0;

  constructor(private readonly cdp: CdpClient) {}

  start(): void {
    this.startedAt = Date.now();
    this.candidates.clear();
    this.unsubscribe.push(
      this.cdp.on<NetworkResponseReceivedEvent>("Network.responseReceived", (event) => {
        const response = event.response;
        const requestId = event.requestId;
        const mimeType = response?.mimeType?.toLowerCase() ?? "";
        const url = response?.url ?? "";
        const status = response?.status ?? 0;
        if (!requestId || !url || !mimeType.startsWith("image/")) return;
        if (status < 200 || status >= 400) return;
        this.candidates.set(requestId, {
          requestId,
          url,
          mimeType,
          encodedDataLength: 0,
          seenAt: Date.now(),
          finishedAt: null,
        });
      }),
    );
    this.unsubscribe.push(
      this.cdp.on<NetworkLoadingFinishedEvent>("Network.loadingFinished", (event) => {
        if (!event.requestId) return;
        const candidate = this.candidates.get(event.requestId);
        if (!candidate) return;
        candidate.encodedDataLength = Number(event.encodedDataLength ?? 0);
        candidate.finishedAt = Date.now();
      }),
    );
  }

  async capture(freshDomImages: DomImage[]): Promise<{ bytes: Buffer; candidate: NetworkCandidate } | null> {
    const deadline = Date.now() + NETWORK_CAPTURE_GRACE_MS;
    while (Date.now() < deadline) {
      const selected = selectBestNetworkCandidate(
        [...this.candidates.values()],
        freshDomImages,
        this.startedAt,
      );
      if (selected) {
        const bytes = await readNetworkBody(this.cdp, selected.requestId);
        if (
          bytes &&
          bytes.length >= MIN_CAPTURE_BYTES &&
          bytes.length <= MAX_CAPTURE_BYTES
        ) {
          return { bytes, candidate: selected };
        }
        this.candidates.delete(selected.requestId);
      }
      await delay(200);
    }
    return null;
  }

  dispose(): void {
    for (const dispose of this.unsubscribe) dispose();
    this.unsubscribe.length = 0;
    this.candidates.clear();
  }
}

export class GeminiWebAutomation {
  private chromeProcess: ChildProcess | null = null;
  private active = false;
  private readonly profileDirectory: string;
  private readonly downloadDirectory: string;
  private readonly sessionFile: string;
  private port: number | null = null;

  constructor(rootDirectory: string) {
    this.profileDirectory = join(rootDirectory, "chrome-profile");
    this.downloadDirectory = join(rootDirectory, "downloads");
    this.sessionFile = join(rootDirectory, "session.json");
  }

  async generateImage(
    prompt: string,
    references: readonly GeminiWebReferenceFile[] = [],
  ): Promise<GeminiWebGenerationResult> {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      throw geminiError("GEMINI_PROMPT_EMPTY", "Gemini prompt must not be empty.");
    }
    if (references.length > 3) {
      throw geminiError(
        "GEMINI_REFERENCE_LIMIT",
        "NarrativeX sends at most three locked character reference images per Visual Beat.",
      );
    }
    if (this.active) {
      throw geminiError(
        "GEMINI_BUSY",
        "Gemini Web is already generating another image. Wait for the current Visual Beat to finish.",
      );
    }

    this.active = true;
    try {
      const port = await this.ensureChrome();
      const page = await this.ensureGeminiPage(port);
      const cdp = await CdpClient.connect(page.webSocketDebuggerUrl as string);
      const networkTracker = new NetworkImageTracker(cdp);
      try {
        await cdp.send("Runtime.enable");
        await cdp.send("Page.enable");
        await cdp.send("DOM.enable");
        await cdp.send("Network.enable", {
          maxTotalBufferSize: 100 * 1024 * 1024,
          maxResourceBufferSize: 25 * 1024 * 1024,
        });
        await cdp.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: this.downloadDirectory,
        });
        await this.navigateToGemini(cdp);
        await this.waitForComposerOrLogin(cdp);
        await this.startFreshConversation(cdp);
        await this.waitForComposerOrLogin(cdp);
        await this.selectModel(cdp, GEMINI_IMAGE_MODEL);
        await this.activateImagesMode(cdp);
        await this.waitForComposerOrLogin(cdp);
        await this.attachReferences(cdp, references);

        // References are attached before both baselines. They can therefore never be mistaken for
        // the generated output by DOM correlation or Network capture.
        const beforeDownload = await this.snapshotDownloads();
        const baseline = await this.generationSnapshot(cdp);
        networkTracker.start();
        await this.submitPrompt(cdp, normalizedPrompt);
        await this.waitForGeneratedImage(cdp, baseline);

        const freshDomImages = await this.freshDomImages(cdp, baseline.imageSources);
        const captured = await networkTracker.capture(freshDomImages);
        if (captured) {
          const sourcePath = await this.persistCapturedImage(
            captured.bytes,
            captured.candidate.mimeType,
            captured.candidate.url,
          );
          if (sourcePath) return { sourcePath, captureMethod: "NETWORK" };
        }

        // UI download is deliberately fallback-only. Gemini DOM changes no longer break the normal
        // success path when the browser already received the generated image bytes.
        await this.triggerDownload(cdp, baseline);
        const sourcePath = await this.waitForDownloadedImage(beforeDownload);
        return { sourcePath, captureMethod: "DOWNLOAD" };
      } finally {
        networkTracker.dispose();
        cdp.close();
      }
    } finally {
      this.active = false;
    }
  }

  async stop(): Promise<void> {
    const port = this.port ?? (await this.readPersistedPort());
    if (port) {
      try {
        const version = await this.fetchJson<DevToolsVersion>(port, "/json/version");
        if (version.webSocketDebuggerUrl) {
          const cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
          try {
            await cdp.send("Browser.close");
          } finally {
            cdp.close();
          }
        }
      } catch {
        // Fall through to the child-process kill below when this process owns Chrome.
      }
    }
    if (this.chromeProcess && !this.chromeProcess.killed) this.chromeProcess.kill();
    this.chromeProcess = null;
    this.port = null;
    await rm(this.sessionFile, { force: true });
  }

  private async ensureChrome(): Promise<number> {
    await Promise.all([
      mkdir(this.profileDirectory, { recursive: true }),
      mkdir(this.downloadDirectory, { recursive: true }),
    ]);

    if (this.port && (await this.devToolsAvailable(this.port))) return this.port;
    const persistedPort = await this.readPersistedPort();
    if (persistedPort && (await this.devToolsAvailable(persistedPort))) {
      this.port = persistedPort;
      return persistedPort;
    }

    const chromePath = await resolveChromeExecutable();
    if (!chromePath) {
      throw geminiError(
        "CHROME_NOT_FOUND",
        "Google Chrome was not found. Install Chrome or set NARRATIVEX_CHROME_PATH to chrome.exe.",
      );
    }

    const port = await findFreePort();
    const chrome = spawn(
      chromePath,
      [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${this.profileDirectory}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--new-window",
        GEMINI_URL,
      ],
      { stdio: "ignore", windowsHide: false },
    );
    chrome.once("exit", () => {
      if (this.chromeProcess === chrome) this.chromeProcess = null;
    });
    this.chromeProcess = chrome;
    this.port = port;
    await writeFile(this.sessionFile, JSON.stringify({ port } satisfies PersistedSession), "utf8");

    const deadline = Date.now() + CHROME_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (chrome.exitCode !== null) {
        throw geminiError("CHROME_START_FAILED", "Chrome exited before Gemini automation could connect.");
      }
      if (await this.devToolsAvailable(port)) return port;
      await delay(250);
    }
    throw geminiError("CHROME_START_TIMEOUT", "Chrome opened but NarrativeX could not connect to it.");
  }

  private async ensureGeminiPage(port: number): Promise<DevToolsTarget> {
    const targets = await this.fetchJson<DevToolsTarget[]>(port, "/json");
    const gemini = targets.find(
      (target) =>
        target.type === "page" &&
        typeof target.url === "string" &&
        target.url.includes("gemini.google.com") &&
        typeof target.webSocketDebuggerUrl === "string",
    );
    if (gemini?.webSocketDebuggerUrl) return gemini;

    const page = targets.find(
      (target) => target.type === "page" && typeof target.webSocketDebuggerUrl === "string",
    );
    if (page?.webSocketDebuggerUrl) return page;

    const created = await this.fetchJson<DevToolsTarget>(
      port,
      `/json/new?${encodeURIComponent(GEMINI_URL)}`,
      "PUT",
    );
    if (!created.webSocketDebuggerUrl) {
      throw geminiError("GEMINI_TAB_UNAVAILABLE", "Chrome did not expose a Gemini tab for automation.");
    }
    return created;
  }

  private async navigateToGemini(cdp: CdpClient): Promise<void> {
    const location = await evaluate<string>(cdp, "window.location.href");
    if (!location.includes("gemini.google.com")) {
      await cdp.send("Page.navigate", { url: GEMINI_URL });
      await delay(1_000);
    }
  }

  private async waitForComposerOrLogin(cdp: CdpClient): Promise<void> {
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const state = await evaluate<{ composer: boolean; signIn: boolean }>(
        cdp,
        `(() => {
          const visible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
          };
          const composer = [...document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"]')]
            .some((element) => visible(element));
          const text = (document.body?.innerText || "").toLowerCase();
          const signIn = text.includes("sign in") || text.includes("đăng nhập");
          return { composer, signIn };
        })()`,
      );
      if (state.composer) return;
      if (state.signIn) {
        await delay(750);
        continue;
      }
      await delay(750);
    }
    throw geminiError(
      "GEMINI_AUTH_REQUIRED",
      "Gemini is not ready. Sign in to the NarrativeX Chrome window, then run generation again.",
    );
  }

  private async startFreshConversation(cdp: CdpClient): Promise<void> {
    await evaluate(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const patterns = ["new chat", "new conversation", "chat mới", "cuộc trò chuyện mới"];
        const elements = [...document.querySelectorAll('button, a')];
        const target = elements.find((element) => {
          if (!visible(element)) return false;
          const value = String(element.getAttribute("aria-label") || "") + " " + String(element.textContent || "");
          const normalized = value.trim().toLowerCase();
          return patterns.some((pattern) => normalized.includes(pattern));
        });
        if (!target) return false;
        target.click();
        return true;
      })()`,
    );
    await delay(500);
  }

  private async selectModel(cdp: CdpClient, modelName: string): Promise<void> {
    const opened = await evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const modelWords = ["model", "gemini", "flash", "pro", "mô hình"];
        const nodes = [...document.querySelectorAll('button, [role="button"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]')];
        const target = nodes.find((element) => {
          if (!visible(element)) return false;
          const value = String(element.getAttribute("aria-label") || "") + " " +
            String(element.getAttribute("title") || "") + " " + String(element.textContent || "");
          const normalized = value.replace(/\\s+/g, " ").trim().toLowerCase();
          return modelWords.some((word) => normalized.includes(word));
        });
        if (!target) return false;
        target.click();
        return true;
      })()`,
    );

    if (!opened) {
      throw geminiError(
        "GEMINI_MODEL_PICKER_NOT_FOUND",
        `NarrativeX could not find the Gemini model picker to select "${modelName}".`,
      );
    }

    await delay(500);

    const candidates = await evaluate<GeminiModelCandidate[]>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        return [...document.querySelectorAll(${JSON.stringify(GEMINI_MODEL_OPTION_SELECTOR)})]
          .filter(visible)
          .map((element) => ({
            role: element.getAttribute("role") || element.tagName.toLowerCase(),
            label: String(element.innerText || element.textContent || ""),
            ariaLabel: String(element.getAttribute("aria-label") || ""),
            title: String(element.getAttribute("title") || ""),
          }));
      })()`,
    );
    const candidateIndex = findGeminiModelCandidateIndex(candidates, modelName);
    if (candidateIndex < 0) {
      throw geminiError(
        "GEMINI_MODEL_NOT_FOUND",
        `Gemini model "${modelName}" was not found in the Gemini Web UI.`,
      );
    }

    const selected = await evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const nodes = [...document.querySelectorAll(${JSON.stringify(GEMINI_MODEL_OPTION_SELECTOR)})]
          .filter(visible);
        const candidate = nodes[${candidateIndex}];
        if (!candidate) return false;
        candidate.click();
        return true;
      })()`,
    );

    if (!selected) {
      throw geminiError(
        "GEMINI_MODEL_NOT_FOUND",
        `Gemini model "${modelName}" was not found in the Gemini Web UI.`,
      );
    }

    await delay(800);
  }

  private async activateImagesMode(cdp: CdpClient): Promise<void> {
    const clickImages = async () =>
      evaluate<boolean>(
        cdp,
        `(() => {
          const visible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
          };
          const patterns = ["images", "image", "hình ảnh", "ảnh", "create image", "create images", "tạo hình ảnh", "tạo ảnh"];
          const elements = [...document.querySelectorAll('button, a, [role="menuitem"], [role="option"]')];
          const target = elements.find((element) => {
            if (!visible(element)) return false;
            const value = String(element.getAttribute("aria-label") || "") + " " + String(element.textContent || "");
            const normalized = value.replace(/\\s+/g, " ").trim().toLowerCase();
            return patterns.some((pattern) => normalized === pattern || normalized.includes(pattern));
          });
          if (!target) return false;
          target.click();
          return true;
        })()`,
      );

    if (await clickImages()) {
      await delay(500);
      return;
    }
    await evaluate(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const patterns = ["menu", "main menu", "trình đơn", "menu chính"];
        const buttons = [...document.querySelectorAll('button')];
        const menu = buttons.find((button) => {
          if (!visible(button)) return false;
          const value = String(button.getAttribute("aria-label") || "") + " " + String(button.textContent || "");
          const normalized = value.trim().toLowerCase();
          return patterns.some((pattern) => normalized === pattern || normalized.includes(pattern));
        });
        if (menu) menu.click();
        return Boolean(menu);
      })()`,
    );
    await delay(500);
    await clickImages();
    await delay(500);
  }

  private async attachReferences(
    cdp: CdpClient,
    references: readonly GeminiWebReferenceFile[],
  ): Promise<void> {
    if (!references.length) return;
    for (const reference of references) {
      const file = await stat(reference.path);
      if (!file.isFile() || file.size <= 0) {
        throw geminiError(
          "GEMINI_REFERENCE_INVALID",
          `Character reference ${reference.refLabel} is missing or empty.`,
        );
      }
      if (!IMAGE_EXTENSIONS.has(extname(reference.path).toLowerCase())) {
        throw geminiError(
          "GEMINI_REFERENCE_INVALID",
          `Character reference ${reference.refLabel} is not a supported image.`,
        );
      }
    }

    let nodeId = await this.findFileInputNode(cdp);
    if (!nodeId) {
      await this.revealFileInput(cdp);
      const deadline = Date.now() + 5_000;
      while (!nodeId && Date.now() < deadline) {
        nodeId = await this.findFileInputNode(cdp);
        if (!nodeId) await delay(150);
      }
    }
    if (!nodeId) {
      throw geminiError(
        "GEMINI_REFERENCE_UPLOAD_CONTROL_NOT_FOUND",
        "NarrativeX could not find Gemini's image attachment input.",
      );
    }

    const before = await this.attachmentSnapshot(cdp);
    await cdp.send("DOM.setFileInputFiles", {
      files: references.map((reference) => reference.path),
      nodeId,
    });

    const deadline = Date.now() + REFERENCE_UPLOAD_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const snapshot = await this.attachmentSnapshot(cdp);
      if (snapshot.error) {
        throw geminiError("GEMINI_REFERENCE_UPLOAD_FAILED", snapshot.error);
      }
      if (snapshot.attachmentCount >= before.attachmentCount + references.length) return;
      if (snapshot.sendEnabled && Date.now() + 2_000 >= deadline) return;
      await delay(250);
    }
    throw geminiError(
      "GEMINI_REFERENCE_UPLOAD_TIMEOUT",
      "Gemini did not finish attaching the character reference images in time.",
    );
  }

  private async findFileInputNode(cdp: CdpClient): Promise<number | null> {
    const evaluated = await cdp.send<{ result?: { objectId?: string } }>("Runtime.evaluate", {
      expression:
        `(() => { const inputs = [...document.querySelectorAll('input[type="file"]')]; ` +
        `return inputs.find((input) => !input.disabled && (!input.accept || input.accept.includes("image") || input.accept.includes("*"))) || inputs.at(-1) || null; })()`,
      returnByValue: false,
    });
    const objectId = evaluated.result?.objectId;
    if (!objectId) return null;
    try {
      const requested = await cdp.send<{ nodeId?: number }>("DOM.requestNode", { objectId });
      return typeof requested.nodeId === "number" && requested.nodeId > 0 ? requested.nodeId : null;
    } finally {
      await cdp.send("Runtime.releaseObject", { objectId }).catch(() => undefined);
    }
  }

  private async revealFileInput(cdp: CdpClient): Promise<void> {
    const clicked = await evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const words = [
          "upload files", "upload file", "upload image", "attach files", "attach file",
          "add files", "add file", "add image", "tải tệp", "tải lên", "tải ảnh",
          "đính kèm", "thêm tệp", "thêm ảnh"
        ];
        const candidates = [...document.querySelectorAll('button, [role="button"], [role="menuitem"], [aria-label], [title]')]
          .filter((element) => visible(element) && !element.disabled);
        const label = (element) => [
          element.getAttribute("aria-label"), element.getAttribute("title"),
          element.getAttribute("data-tooltip"), element.textContent
        ].filter(Boolean).join(" ").replace(/\\s+/g, " ").trim().toLowerCase();
        const direct = candidates.find((element) => words.some((word) => label(element).includes(word)));
        if (direct) { direct.click(); return true; }
        const attachment = candidates.find((element) => {
          const value = label(element);
          return value.includes("attach") || value.includes("upload") || value.includes("đính kèm") || value.includes("thêm");
        });
        if (!attachment) return false;
        attachment.click();
        return true;
      })()`,
    );
    if (!clicked) return;
    await delay(400);
    if (await this.findFileInputNode(cdp)) return;
    await evaluate(
      cdp,
      `(() => {
        const words = ["upload files", "upload image", "tải tệp", "tải ảnh", "thêm ảnh"];
        const elements = [...document.querySelectorAll('[role="menuitem"], [role="option"], button')];
        const target = elements.find((element) => {
          const value = [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
            .filter(Boolean).join(" ").replace(/\\s+/g, " ").trim().toLowerCase();
          return words.some((word) => value.includes(word));
        });
        if (!target) return false;
        target.click();
        return true;
      })()`,
    );
    await delay(350);
  }

  private async attachmentSnapshot(cdp: CdpClient): Promise<{
    attachmentCount: number;
    sendEnabled: boolean;
    error: string | null;
  }> {
    return evaluate(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 4 && rect.height > 4;
        };
        const attachmentSelectors = [
          '[aria-label*="remove" i]', '[aria-label*="attachment" i]', '[aria-label*="preview" i]',
          '[data-test-id*="attachment" i]', '[data-testid*="attachment" i]',
          'img[src^="blob:"]'
        ];
        const attachments = new Set();
        for (const selector of attachmentSelectors) {
          for (const element of document.querySelectorAll(selector)) {
            if (visible(element)) attachments.add(element);
          }
        }
        const sendWords = ["send", "submit", "gửi"];
        const sendEnabled = [...document.querySelectorAll('button')].some((button) => {
          if (!visible(button) || button.disabled) return false;
          const value = [button.getAttribute("aria-label"), button.getAttribute("title"), button.textContent]
            .filter(Boolean).join(" ").trim().toLowerCase();
          return sendWords.some((word) => value === word || value.includes(word));
        });
        const body = (document.body?.innerText || "").toLowerCase();
        const error = body.includes("upload failed") || body.includes("failed to upload") || body.includes("tải lên thất bại")
          ? "Gemini reported that a character reference image failed to upload."
          : null;
        return { attachmentCount: attachments.size, sendEnabled, error };
      })()`,
    );
  }

  private async submitPrompt(cdp: CdpClient, prompt: string): Promise<void> {
    const inserted = await evaluate<boolean>(
      cdp,
      `(() => {
        const prompt = ${JSON.stringify(prompt)};
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"]')]
          .filter((element) => visible(element));
        const editor = candidates.at(-1);
        if (!editor) return false;
        editor.focus();
        if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
          const prototype = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
          if (setter) setter.call(editor, prompt); else editor.value = prompt;
        } else {
          editor.textContent = prompt;
        }
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`,
    );
    if (!inserted) {
      throw geminiError("GEMINI_UI_CHANGED", "NarrativeX could not find the Gemini prompt editor.");
    }

    await delay(300);
    const clicked = await evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const patterns = ["send", "submit", "gửi"];
        const button = [...document.querySelectorAll('button')].find((candidate) => {
          if (!visible(candidate) || candidate.disabled) return false;
          const value = String(candidate.getAttribute("aria-label") || "") + " " +
            String(candidate.getAttribute("title") || "") + " " + String(candidate.textContent || "");
          const normalized = value.trim().toLowerCase();
          return patterns.some((pattern) => normalized === pattern || normalized.includes(pattern));
        });
        if (!button) return false;
        button.click();
        return true;
      })()`,
    );
    if (clicked) return;
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
  }

  private async generationSnapshot(cdp: CdpClient): Promise<GenerationSnapshot> {
    return evaluate<GenerationSnapshot>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const downloadWords = ["download full size", "download", "tải xuống", "tải ảnh"];
        const downloadCount = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"], [role="option"], [tabindex]')].filter((element) => {
          if (!visible(element)) return false;
          const value = String(element.getAttribute("aria-label") || "") + " " +
            String(element.getAttribute("title") || "") + " " + String(element.textContent || "");
          const normalized = value.trim().toLowerCase();
          return downloadWords.some((word) => normalized.includes(word));
        }).length;
        const imageSources = [...document.querySelectorAll('img')]
          .filter((image) => visible(image) && image.naturalWidth >= 256 && image.naturalHeight >= 256)
          .map((image) => image.currentSrc || image.src || "")
          .filter(Boolean);
        const text = (document.body?.innerText || "").toLowerCase();
        const blocked = text.includes("can't generate") || text.includes("cannot generate") ||
          text.includes("không thể tạo") || text.includes("unable to generate");
        return { downloadCount, imageSources, blocked };
      })()`,
    );
  }

  private async waitForGeneratedImage(cdp: CdpClient, baseline: GenerationSnapshot): Promise<void> {
    const baselineImages = new Set(baseline.imageSources);
    const deadline = Date.now() + GENERATION_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const state = await this.generationSnapshot(cdp);
      if (state.blocked) {
        throw geminiError(
          "GEMINI_GENERATION_REJECTED",
          "Gemini did not generate an image for this Visual Beat.",
        );
      }
      const hasNewImage = state.imageSources.some((source) => !baselineImages.has(source));
      if (state.downloadCount > baseline.downloadCount || hasNewImage) {
        await delay(800);
        return;
      }
      await delay(500);
    }
    throw geminiError("GEMINI_GENERATION_TIMEOUT", "Gemini image generation did not finish in time.");
  }

  private async freshDomImages(cdp: CdpClient, baselineSources: string[]): Promise<DomImage[]> {
    const baselineJson = JSON.stringify(baselineSources);
    return evaluate<DomImage[]>(
      cdp,
      `(() => {
        const baseline = new Set(${baselineJson});
        return [...document.querySelectorAll('img')]
          .filter((image) => {
            const style = window.getComputedStyle(image);
            const rect = image.getBoundingClientRect();
            const src = image.currentSrc || image.src || "";
            return src && !baseline.has(src) && style.display !== "none" && style.visibility !== "hidden" &&
              rect.width >= 128 && rect.height >= 128 && image.naturalWidth >= 256 && image.naturalHeight >= 256;
          })
          .map((image) => ({ src: image.currentSrc || image.src || "", area: image.naturalWidth * image.naturalHeight }));
      })()`,
    );
  }

  private async persistCapturedImage(
    bytes: Buffer,
    mimeType: string,
    url: string,
  ): Promise<string | null> {
    const extension = imageExtensionForMimeType(mimeType) ?? extensionForUrl(url);
    if (!extension || bytes.length < MIN_CAPTURE_BYTES || bytes.length > MAX_CAPTURE_BYTES) return null;
    const sourcePath = join(
      this.downloadDirectory,
      `gemini-network-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}${extension}`,
    );
    await writeFile(sourcePath, bytes);
    const file = await stat(sourcePath);
    return file.isFile() && file.size === bytes.length ? sourcePath : null;
  }

  private async triggerDownload(cdp: CdpClient, baseline: GenerationSnapshot): Promise<void> {
    const clickDownload = () =>
      evaluate<boolean>(
        cdp,
        `(() => {
          const visible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
          };
          const words = ["download full size", "download image", "download", "tải xuống", "tải hình ảnh", "tải ảnh"];
          const candidates = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"], [role="option"], [tabindex], [aria-label], [title]')].filter((element) => {
            if (!visible(element)) return false;
            const value = [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
              .filter(Boolean).join(" ").trim().toLowerCase();
            return words.some((word) => value.includes(word));
          });
          const target = candidates.at(-1);
          if (!target) return false;
          target.click();
          return true;
        })()`,
      );

    const snapshot = await this.generationSnapshot(cdp);
    if (snapshot.downloadCount > baseline.downloadCount && (await clickDownload())) return;
    if (await clickDownload()) return;

    const baselineImagesJson = JSON.stringify(baseline.imageSources);
    const imageRect = await evaluate<{ x: number; y: number } | null>(
      cdp,
      `(() => {
        const baseline = new Set(${baselineImagesJson});
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const images = [...document.querySelectorAll('img')]
          .filter((image) => visible(image) && image.naturalWidth >= 256 && image.naturalHeight >= 256);
        const image = images.find((candidate) => !baseline.has(candidate.currentSrc || candidate.src || "")) || images.at(-1);
        if (!image) return null;
        image.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
        const rect = image.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`,
    );
    if (imageRect) {
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseMoved", x: imageRect.x, y: imageRect.y,
      });
      await delay(500);
      if (await clickDownload()) return;
    }

    if (await this.downloadVisibleGeneratedImage(cdp, baseline)) return;
    if (await this.captureVisibleGeneratedImage(cdp, baseline)) return;

    throw geminiError(
      "GEMINI_IMAGE_CAPTURE_FAILED",
      "Gemini generated an image, but NarrativeX could not download or capture it after network capture fallback.",
    );
  }

  private async downloadVisibleGeneratedImage(
    cdp: CdpClient,
    baseline: GenerationSnapshot,
  ): Promise<boolean> {
    const baselineImagesJson = JSON.stringify(baseline.imageSources);
    return await evaluate<boolean>(
      cdp,
      `(async () => {
        const baseline = new Set(${baselineImagesJson});
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const images = [...document.querySelectorAll("img")]
          .filter((image) => visible(image) && image.naturalWidth >= 256 && image.naturalHeight >= 256);
        const image = images.find((candidate) => !baseline.has(candidate.currentSrc || candidate.src || "")) || images.at(-1);
        if (!image) return false;

        const source = image.currentSrc || image.src || "";
        if (!source || source.startsWith("data:")) return false;
        try {
          const response = await fetch(source, { credentials: "include" });
          if (!response.ok) return false;
          const blob = await response.blob();
          const mime = blob.type || "image/png";
          const extension = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = objectUrl;
          link.download = "gemini-image-" + Date.now() + "." + extension;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
          return true;
        } catch {
          return false;
        }
      })()`,
    );
  }

  private async captureVisibleGeneratedImage(
    cdp: CdpClient,
    baseline: GenerationSnapshot,
  ): Promise<boolean> {
    const baselineImagesJson = JSON.stringify(baseline.imageSources);
    const clip = await evaluate<{
      x: number;
      y: number;
      width: number;
      height: number;
      scale: number;
    } | null>(
      cdp,
      `(() => {
        const baseline = new Set(${baselineImagesJson});
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const images = [...document.querySelectorAll("img")]
          .filter((image) => visible(image) && image.naturalWidth >= 256 && image.naturalHeight >= 256);
        const image = images.find((candidate) => !baseline.has(candidate.currentSrc || candidate.src || "")) || images.at(-1);
        if (!image) return null;
        image.scrollIntoView({ block: "center", inline: "center" });
        const rect = image.getBoundingClientRect();
        return {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
          scale: Math.min(window.devicePixelRatio || 1, 2),
        };
      })()`,
    );
    if (!clip || clip.width <= 0 || clip.height <= 0) return false;

    const screenshot = await cdp.send<{ data?: string }>("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip,
    });
    if (!screenshot?.data) return false;

    const fallbackPath = join(this.downloadDirectory, `gemini-image-fallback-${Date.now()}.png`);
    await writeFile(fallbackPath, Buffer.from(screenshot.data, "base64"));
    return true;
  }

  private async snapshotDownloads(): Promise<Set<string>> {
    const entries = await readdir(this.downloadDirectory, { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  }

  private async waitForDownloadedImage(before: Set<string>): Promise<string> {
    const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
    let stablePath: string | null = null;
    let stableSize = -1;
    while (Date.now() < deadline) {
      const entries = await readdir(this.downloadDirectory, { withFileTypes: true });
      const candidates = entries
        .filter((entry) => entry.isFile() && !before.has(entry.name))
        .map((entry) => join(this.downloadDirectory, entry.name));
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
    throw geminiError(
      "GEMINI_DOWNLOAD_FAILED",
      "Gemini finished, but the generated image was not downloaded.",
    );
  }

  private async readPersistedPort(): Promise<number | null> {
    try {
      const value = JSON.parse(await readFile(this.sessionFile, "utf8")) as Partial<PersistedSession>;
      return Number.isInteger(value.port) && Number(value.port) > 0 ? Number(value.port) : null;
    } catch {
      return null;
    }
  }

  private async devToolsAvailable(port: number): Promise<boolean> {
    try {
      const version = await this.fetchJson<DevToolsVersion>(port, "/json/version");
      return typeof version.webSocketDebuggerUrl === "string";
    } catch {
      return false;
    }
  }

  private async fetchJson<T>(port: number, path: string, method = "GET"): Promise<T> {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) throw new Error(`Chrome DevTools returned ${response.status}.`);
    return (await response.json()) as T;
  }
}

async function readNetworkBody(cdp: CdpClient, requestId: string): Promise<Buffer | null> {
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

function extensionForUrl(value: string): string | null {
  try {
    const extension = extname(new URL(value).pathname).toLowerCase();
    return IMAGE_EXTENSIONS.has(extension) ? extension : null;
  } catch {
    return null;
  }
}

async function evaluate<T>(cdp: CdpClient, expression: string): Promise<T> {
  const response = await cdp.send<{
    result?: { value?: T; description?: string };
    exceptionDetails?: unknown;
  }>("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.result?.description || "Gemini page script failed.");
  }
  return response.result?.value as T;
}

async function findFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a Chrome debugging port."));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function resolveChromeExecutable(): Promise<string | null> {
  const configured = process.env.NARRATIVEX_CHROME_PATH?.trim();
  if (configured && (await executableExists(configured))) return configured;

  const candidates: string[] = [];
  if (process.platform === "win32") {
    for (const root of [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ]) {
      if (root) candidates.push(join(root, "Google", "Chrome", "Application", "chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    candidates.push(
      join(process.env.HOME || "", "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    );
  } else {
    for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
      const fromPath = await resolveFromPath(name);
      if (fromPath) candidates.push(fromPath);
    }
  }

  for (const candidate of candidates) {
    if (candidate && (await executableExists(candidate))) return candidate;
  }
  return null;
}

async function resolveFromPath(name: string): Promise<string | null> {
  for (const directory of (process.env.PATH || "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    if (await executableExists(candidate)) return candidate;
  }
  return null;
}

async function executableExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function geminiError(code: string, message: string): Error {
  const error = new Error(`[${code}] ${message}`);
  error.name = code;
  return error;
}
