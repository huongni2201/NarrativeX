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
import { hasCompletedGeminiGeneration } from "./gemini-web-generation-state";
import {
  GEMINI_WEB_LANES,
  type GeminiWebLane,
} from "../../shared/gemini-web-lanes";

const GEMINI_URL = "https://gemini.google.com/app";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const CHROME_START_TIMEOUT_MS = 20_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const GENERATION_TIMEOUT_MS = 4 * 60_000;
const GEMINI_UI_READY_TIMEOUT_MS = 12_000;
const GEMINI_IMAGE_MODEL = "Gemini 3.1 Pro";
const GEMINI_IMAGE_PRESET = "Điện ảnh";
const NETWORK_CAPTURE_GRACE_MS = 8_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const REFERENCE_UPLOAD_TIMEOUT_MS = 30_000;
const MAX_CAPTURE_BYTES = 20 * 1024 * 1024;
const GEMINI_CHROME_BACKGROUND_FLAGS = [
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion",
] as const;
const GEMINI_MODEL_OPTION_SELECTOR =
  'button, [role="option"], [role="menuitem"], [role="menuitemradio"], [role="radio"], gem-menu-item';
const GEMINI_GENERATED_IMAGE_SELECTOR = [
  "generated-image img",
  "single-image img",
  '[data-testid*="generated" i] img',
  '[data-test-id*="generated" i] img',
  'img[aria-label*="generated" i]',
  'img[alt*="generated" i]',
  'img[src*="googleusercontent.com"]',
].join(", ");

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
  id?: string;
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type PersistedSession = {
  port: number;
  targets?: Partial<Record<GeminiWebLane, string>>;
};

type GeminiLaneState = {
  active: boolean;
  targetId: string | null;
  downloadDirectory: string;
};

type CdpEnvelope = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
};

type GenerationSnapshot = {
  generatedImageCount: number;
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
            // Observers must never break the CDP transport.
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
        if (bytes && bytes.length > 0 && bytes.length <= MAX_CAPTURE_BYTES) {
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
  private readonly profileDirectory: string;
  private readonly sessionFile: string;
  private port: number | null = null;
  private chromeStartPromise: Promise<number> | null = null;
  private sessionWritePromise: Promise<void> = Promise.resolve();
  private readonly lanes = new Map<GeminiWebLane, GeminiLaneState>();

  constructor(rootDirectory: string) {
    this.profileDirectory = join(rootDirectory, "chrome-profile");
    this.sessionFile = join(rootDirectory, "session.json");
    for (const lane of GEMINI_WEB_LANES) {
      this.lanes.set(lane, {
        active: false,
        targetId: null,
        downloadDirectory: join(rootDirectory, "lanes", lane.toLowerCase(), "downloads"),
      });
    }
  }

  async generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references: readonly GeminiWebReferenceFile[] = [],
  ): Promise<GeminiWebGenerationResult> {
    const laneState = this.lanes.get(lane);
    if (!laneState) {
      throw geminiError("GEMINI_LANE_INVALID", "Gemini generation lane is not supported.");
    }
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
    if (laneState.active) {
      throw geminiError(
        "GEMINI_BUSY",
        `Gemini Web ${lane} is already generating another image. Wait for the current request to finish.`,
      );
    }

    laneState.active = true;
    try {
      const port = await this.ensureChrome();
      const page = await this.ensureGeminiPage(port, lane);
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
          downloadPath: laneState.downloadDirectory,
        });

        await this.navigateToGemini(cdp);
        await this.waitForComposerOrLogin(cdp);
        await delay(600);
        await this.startFreshConversation(cdp);
        await this.waitForComposerOrLogin(cdp);
        await delay(800);
        await this.activateImagesMode(cdp);
        await delay(800);
        await this.selectImagePreset(cdp, GEMINI_IMAGE_PRESET);
        await delay(800);
        await this.selectModel(cdp, GEMINI_IMAGE_MODEL);
        await delay(800);
        await this.waitForComposerOrLogin(cdp);
        await this.attachReferences(cdp, references);
        if (references.length > 0) {
          await delay(800);
        }

        const beforeDownload = await this.snapshotDownloads(laneState.downloadDirectory);
        const baseline = await this.generationSnapshot(cdp);
        networkTracker.start();
        await cdp.send("Page.bringToFront");
        await this.submitPrompt(cdp, normalizedPrompt);
        await this.waitForGeneratedImage(cdp, baseline);

        const freshDomImages = await this.freshDomImages(cdp, baseline);
        const captured = await networkTracker.capture(freshDomImages);
        if (captured) {
          const sourcePath = await this.persistCapturedImage(
            captured.bytes,
            captured.candidate.mimeType,
            captured.candidate.url,
            laneState.downloadDirectory,
          );
          if (sourcePath) return { sourcePath, captureMethod: "NETWORK" };
        }

        const sourcePath = await this.captureGeneratedImageFallback(
          cdp,
          baseline,
          beforeDownload,
          laneState.downloadDirectory,
        );
        return { sourcePath, captureMethod: "DOWNLOAD" };
      } finally {
        networkTracker.dispose();
        cdp.close();
      }
    } finally {
      laneState.active = false;
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
        // Child-process kill below is the final fallback when this process owns Chrome.
      }
    }
    if (this.chromeProcess && !this.chromeProcess.killed) this.chromeProcess.kill();
    this.chromeProcess = null;
    this.port = null;
    for (const lane of this.lanes.values()) {
      lane.active = false;
      lane.targetId = null;
    }
    await this.sessionWritePromise;
    await rm(this.sessionFile, { force: true });
  }

  private async ensureChrome(): Promise<number> {
    await Promise.all([
      mkdir(this.profileDirectory, { recursive: true }),
      ...[...this.lanes.values()].map((lane) => mkdir(lane.downloadDirectory, { recursive: true })),
    ]);

    if (this.port && (await this.devToolsAvailable(this.port))) return this.port;
    if (this.chromeStartPromise) return this.chromeStartPromise;

    this.chromeStartPromise = this.startChrome();
    try {
      return await this.chromeStartPromise;
    } finally {
      this.chromeStartPromise = null;
    }
  }

  private async startChrome(): Promise<number> {
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
        ...GEMINI_CHROME_BACKGROUND_FLAGS,
        "--start-minimized",
        "--new-window",
        "about:blank",
      ],
      { stdio: "ignore", windowsHide: false },
    );
    chrome.once("exit", () => {
      if (this.chromeProcess === chrome) this.chromeProcess = null;
    });
    this.chromeProcess = chrome;
    this.port = port;
    await this.writePersistedSession();

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

  private async ensureGeminiPage(port: number, lane: GeminiWebLane): Promise<DevToolsTarget> {
    const laneState = this.lanes.get(lane);
    if (!laneState) throw geminiError("GEMINI_LANE_INVALID", "Gemini generation lane is not supported.");
    const targets = await this.fetchJson<DevToolsTarget[]>(port, "/json");
    const persisted = await this.readPersistedSession();
    const targetId = laneState.targetId ?? persisted?.targets?.[lane];
    if (targetId) {
      const target = targets.find(
        (candidate) =>
          candidate.id === targetId &&
          candidate.type === "page" &&
          typeof candidate.webSocketDebuggerUrl === "string",
      );
      if (target?.webSocketDebuggerUrl) {
        laneState.targetId = targetId;
        await this.writePersistedSession();
        return target;
      }
      laneState.targetId = null;
      await this.writePersistedSession();
    }

    const created = await this.fetchJson<DevToolsTarget>(
      port,
      `/json/new?${encodeURIComponent(GEMINI_URL)}`,
      "PUT",
    );
    if (!created.id || !created.webSocketDebuggerUrl) {
      throw geminiError("GEMINI_TAB_UNAVAILABLE", "Chrome did not expose a Gemini tab for automation.");
    }
    laneState.targetId = created.id;
    await this.writePersistedSession();
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
          const composer = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"][role="textbox"], [contenteditable="true"]')]
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
      await delay(500);
    }
    throw geminiError(
      "GEMINI_AUTH_REQUIRED",
      "Gemini is not ready. Sign in to the NarrativeX Chrome window, then run generation again.",
    );
  }

  private async startFreshConversation(cdp: CdpClient): Promise<void> {
    const isThread = await evaluate<boolean>(
      cdp,
      `(() => {
        const path = window.location.pathname;
        return path.length > 5 && path.startsWith("/app/");
      })()`,
    );

    if (isThread) {
      await cdp.send("Page.navigate", { url: "https://gemini.google.com/app" });
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        await delay(300);
        const currentPath = await evaluate<string>(cdp, "window.location.pathname");
        if (currentPath === "/app" || currentPath === "/app/") break;
      }
      await delay(800);
      await this.waitForComposerOrLogin(cdp);
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

        const geminiLogo = document.querySelector('a[href="/app"], a[aria-label*="Gemini"]');
        if (geminiLogo && visible(geminiLogo)) {
          geminiLogo.click();
          return true;
        }

        const patterns = ["new chat", "cuộc trò chuyện mới", "chat mới"];
        const elements = [...document.querySelectorAll('button, a')].filter((el) => {
          if (!visible(el)) return false;
          const label = (el.getAttribute("aria-label") || "").toLowerCase();
          if (label.includes("thanh bên") || label.includes("sidebar") || label.includes("mở thanh bên")) return false;
          return true;
        });

        const target = elements.find((element) => {
          const value = String(element.getAttribute("aria-label") || "") + " " + String(element.textContent || "");
          const normalized = value.replace(/\\s+/g, " ").trim().toLowerCase();
          return patterns.some((pattern) => normalized.includes(pattern));
        });
        if (!target) return false;
        target.click();
        return true;
      })()`,
    );
    await delay(800);
  }

  private async activateImagesMode(cdp: CdpClient): Promise<void> {
    const deadline = Date.now() + GEMINI_UI_READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (await this.isImageModeReady(cdp)) return;

      if (await this.clickCreateImageAction(cdp)) {
        if (await this.waitForImageModeReady(cdp, 4_000)) return;
        await delay(300);
        if (await this.isImageModeReady(cdp)) return;
      }

      if (await this.openImageModeMenu(cdp)) {
        await delay(500);

        if (await this.clickCreateImageAction(cdp)) {
          if (await this.waitForImageModeReady(cdp, 4_000)) return;
          await delay(300);
          if (await this.isImageModeReady(cdp)) return;
        }
      }

      await delay(300);
    }

    throw geminiError(
      "GEMINI_IMAGE_MODE_NOT_FOUND",
      "NarrativeX could not open Gemini image creation mode.",
    );
  }

  private async clickCreateImageAction(cdp: CdpClient): Promise<boolean> {
    return evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 4 &&
            rect.height > 4
          );
        };

        const unwantedPatterns = [
          "tải tệp", "tải lên", "drive", "video", "nhạc", "canvas",
          "research", "hướng dẫn", "công cụ khác", "upload file", "upload files"
        ];

        const allElements = [
          ...document.querySelectorAll(
            'button, a, [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="option"], [role="tab"], [role="listitem"], li, div, span, p, mat-list-item, gux-menu-item',
          ),
        ].filter((element) => visible(element) && !element.disabled);

        const labelOf = (element) =>
          [
            element.getAttribute("aria-label"),
            element.getAttribute("title"),
            element.getAttribute("data-tooltip"),
            element.innerText,
            element.textContent,
          ]
            .filter(Boolean)
            .join(" ")
            .replace(/\\s+/g, " ")
            .trim()
            .toLowerCase();

        const candidates = [];
        for (const element of allElements) {
          const candidateText = labelOf(element);
          if (!candidateText) continue;
          if (unwantedPatterns.some((unwanted) => candidateText.includes(unwanted))) continue;

          if (candidateText === "tạo hình ảnh" || candidateText === "create image" || candidateText === "tạo ảnh" || candidateText === "create images") {
            candidates.push({ element, score: 100 });
            continue;
          }

          if (candidateText.startsWith("tạo hình ảnh") || candidateText.startsWith("create image") || candidateText.startsWith("tạo ảnh")) {
            candidates.push({ element, score: 90 });
            continue;
          }

          if (candidateText.length <= 40 && (candidateText.includes("tạo hình ảnh") || candidateText.includes("create image") || candidateText.includes("tạo ảnh"))) {
            candidates.push({ element, score: 80 });
            continue;
          }

          if (candidateText === "hình ảnh" || candidateText === "images" || candidateText === "image" || candidateText === "ảnh") {
            candidates.push({ element, score: 50 });
            continue;
          }
        }

        if (!candidates.length) return false;

        candidates.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const rectA = a.element.getBoundingClientRect();
          const rectB = b.element.getBoundingClientRect();
          return (rectA.width * rectA.height) - (rectB.width * rectB.height);
        });

        const target = candidates[0].element;
        const clickable = target.closest('button, a, [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="option"], [role="listitem"], li, mat-list-item') || target;

        clickable.scrollIntoView({ block: "center", inline: "center" });
        clickable.click();
        return true;
      })()`,
    );
  }

  private async openImageModeMenu(cdp: CdpClient): Promise<boolean> {
    return evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 4 &&
            rect.height > 4
          );
        };

        const existingMenuItems = [
          ...document.querySelectorAll('[role="menuitemcheckbox"], [role="menuitem"], .toolbox-drawer-item-list-button')
        ].filter(visible);
        const hasOpenMenu = existingMenuItems.some((el) => {
          const t = (el.innerText || el.textContent || "").trim().toLowerCase();
          return t.includes("tạo hình ảnh") || t.includes("create image") || t.includes("tạo ảnh");
        });
        if (hasOpenMenu) return true;

        const toolButtons = [
          ...document.querySelectorAll(
            'button[aria-label*="tải lên" i], button[aria-label*="công cụ" i], button[aria-label*="tools" i], button[aria-label*="add" i], button[aria-label*="upload" i], button[aria-label*="thêm" i], [aria-haspopup="menu"]'
          )
        ].filter((element) => {
          if (!visible(element) || element.disabled) return false;
          const label = (element.getAttribute("aria-label") || "").toLowerCase();
          if (label.includes("cài đặt") || label.includes("setting") || label.includes("thanh bên") || label.includes("sidebar")) {
            return false;
          }
          return true;
        });

        if (!toolButtons.length) return false;

        const target = toolButtons.find((el) => {
          const label = (el.getAttribute("aria-label") || "").toLowerCase();
          return label.includes("tải lên và công cụ") || label.includes("nội dung tải lên") || label.includes("uploads and tools");
        }) || toolButtons[0];

        target.click();
        return true;
      })()`,
    );
  }

  private async isImageModeReady(cdp: CdpClient): Promise<boolean> {
    return evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 4 &&
            rect.height > 4
          );
        };

        const chips = [...document.querySelectorAll('button')].filter(visible);
        const hasImageChip = chips.some((b) => {
          const aria = (b.getAttribute("aria-label") || "").toLowerCase();
          const text = (b.innerText || b.textContent || "").trim().toLowerCase();
          return (
            aria.includes("bỏ chọn hình ảnh") ||
            aria.includes("deselect image") ||
            (text === "hình ảnh" && (b.className.includes("mat-tonal-button") || b.className.includes("mat-badge"))) ||
            (text === "image" && (b.className.includes("mat-tonal-button") || b.className.includes("mat-badge")))
          );
        });

        if (hasImageChip) return true;

        const editors = [
          ...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"][role="textbox"], [contenteditable="true"]'),
        ].filter(visible);

        const hasImagePromptEditor = editors.some((element) => {
          const value = [
            element.getAttribute("placeholder"),
            element.getAttribute("aria-label"),
            element.getAttribute("title"),
          ]
            .filter(Boolean)
            .join(" ")
            .replace(/\\s+/g, " ")
            .trim()
            .toLowerCase();

          return (
            value.includes("mô tả hình ảnh") ||
            value.includes("mô tả hình ảnh của bạn") ||
            value.includes("describe your image") ||
            value.includes("tạo hình ảnh") ||
            value.includes("create image") ||
            value.includes("image prompt")
          );
        });

        if (hasImagePromptEditor) return true;

        const headings = [...document.querySelectorAll('h1, h2, h3, h4, div, p')].filter(visible);
        const hasHeading = headings.some((element) => {
          const text = (element.innerText || element.textContent || "").trim().toLowerCase();
          const rect = element.getBoundingClientRect();
          return (text === "tạo hình ảnh" || text === "create image" || text === "create images") && rect.top < 350 && rect.width > 50;
        });

        return hasHeading;
      })()`,
    );
  }

  private async waitForImageModeReady(cdp: CdpClient, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isImageModeReady(cdp)) return true;
      await delay(200);
    }
    return false;
  }

  private async selectModel(cdp: CdpClient, modelName: string): Promise<void> {
    const deadline = Date.now() + GEMINI_UI_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await this.isModelAlreadySelected(cdp, modelName)) return;

      const opened = await evaluate<boolean>(
        cdp,
        `(() => {
          const visible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
          };
          const modelBtn = document.querySelector('button.input-area-switch, button[aria-label*="chọn chế độ"], button[aria-label*="mode selector"], input-area-switch button');
          if (modelBtn && visible(modelBtn)) {
            modelBtn.click();
            return true;
          }
          const nodes = [...document.querySelectorAll('button, [role="button"], bard-mode-menu-button, input-area-switch')];
          const target = nodes.find((element) => {
            if (!visible(element)) return false;
            const value = [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
              .filter(Boolean).join(" ").replace(/\\s+/g, " ").trim().toLowerCase();
            return value === "pro" || value === "flash" || value === "thinking" || value.includes("mô hình") || value.includes("chọn chế độ");
          });
          if (!target) return false;
          target.click();
          return true;
        })()`,
      );

      if (!opened) {
        await delay(300);
        continue;
      }

      await delay(600);

      const optionDeadline = Math.min(deadline, Date.now() + 4_000);
      while (Date.now() < optionDeadline) {
        const candidates = await this.modelCandidates(cdp);
        const candidateIndex = findGeminiModelCandidateIndex(candidates, modelName);
        if (candidateIndex >= 0) {
          const selected = await evaluate<boolean>(
            cdp,
            `(() => {
              const visible = (element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
              };
              const nodes = [...document.querySelectorAll(${JSON.stringify(GEMINI_MODEL_OPTION_SELECTOR)})].filter(visible);
              const candidate = nodes[${candidateIndex}];
              if (!candidate) return false;
              candidate.click();
              return true;
            })()`,
          );
          if (selected) {
            await delay(600);
            if (await this.isModelAlreadySelected(cdp, modelName)) return;
            return;
          }
        }
        await delay(200);
      }
    }

    throw geminiError(
      "GEMINI_MODEL_PICKER_NOT_FOUND",
      `NarrativeX could not select Gemini model "${modelName}" after waiting for the image UI to become ready.`,
    );
  }

  private async isModelAlreadySelected(cdp: CdpClient, modelName: string): Promise<boolean> {
    return evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };

        const modelBtn = document.querySelector('button.input-area-switch, button[aria-label*="chọn chế độ"], button[aria-label*="mode selector"], input-area-switch button');
        if (!modelBtn || !visible(modelBtn)) return false;

        const text = (modelBtn.innerText || modelBtn.textContent || "").trim().toLowerCase();
        const aria = (modelBtn.getAttribute("aria-label") || "").toLowerCase();

        return text === "pro" || text.startsWith("pro ") || aria.includes("hiện tại là pro") || aria.includes("currently pro");
      })()`,
    );
  }

  private async modelCandidates(cdp: CdpClient): Promise<GeminiModelCandidate[]> {
    return evaluate<GeminiModelCandidate[]>(
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
  }

  private async isPresetChipApplied(cdp: CdpClient, presetName: string): Promise<boolean> {
    return evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 2 && rect.height > 2;
        };
        const targets = [${JSON.stringify(presetName.toLowerCase())}, "cinematic", "điện ảnh"];
        const elements = [
          ...document.querySelectorAll(
            'button, mat-chip, .mat-mdc-chip, mat-basic-chip, gem-style-attachment, uploader-file-preview, [role="button"], [aria-label*="close" i], [aria-label*="bỏ chọn" i], [aria-label*="xóa" i], .input-area *, .composer *, form *'
          )
        ].filter(visible);

        return elements.some((el) => {
          const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
          const t = (el.innerText || el.textContent || "").trim().toLowerCase();

          if (aria.includes("close") || aria.includes("bỏ chọn") || aria.includes("xóa") || aria.includes("deselect") || aria.includes("remove")) {
            return targets.some((target) => aria.includes(target) || t.includes(target));
          }
          if (el.closest('.input-area, .composer, form, .file-preview-container, .chips-container, uploader-file-preview, gem-style-attachment')) {
            return targets.some((target) => t === target || t.includes(target) || aria.includes(target));
          }
          return false;
        });
      })()`,
    );
  }

  private async selectImagePreset(cdp: CdpClient, presetName: string): Promise<void> {
    if (await this.isPresetChipApplied(cdp, presetName)) return;

    const deadline = Date.now() + GEMINI_UI_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await this.isPresetChipApplied(cdp, presetName)) return;

      const clicked = await evaluate<boolean>(
        cdp,
        `(() => {
          const visible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 2 &&
              rect.height > 2
            );
          };

          const targets = [${JSON.stringify(presetName.toLowerCase())}, "cinematic", "điện ảnh"];

          const candidates = [...document.querySelectorAll('*')].filter((el) => {
            if (!visible(el)) return false;
            if (el.closest('.file-preview-container, .user-query-container, .input-area')) return false;
            const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
            return targets.some((target) => t === target);
          });

          if (!candidates.length) return false;

          candidates.sort((a, b) => {
            const rA = a.getBoundingClientRect();
            const rB = b.getBoundingClientRect();
            return (rA.width * rA.height) - (rB.width * rB.height);
          });

          const leaf = candidates[0];
          let card = leaf;
          let curr = leaf.parentElement;
          while (curr && curr !== document.body) {
            const r = curr.getBoundingClientRect();
            if (r.width > 320 || r.height > 320) break;
            card = curr;
            curr = curr.parentElement;
          }

          card.scrollIntoView({ block: "center", inline: "center" });

          const opts = { bubbles: true, cancelable: true, composed: true, view: window };
          card.dispatchEvent(new PointerEvent("pointerdown", opts));
          card.dispatchEvent(new MouseEvent("mousedown", opts));
          card.dispatchEvent(new PointerEvent("pointerup", opts));
          card.dispatchEvent(new MouseEvent("mouseup", opts));
          card.dispatchEvent(new MouseEvent("click", opts));
          return true;
        })()`,
      );

      if (clicked) {
        const verifyDeadline = Date.now() + 2_500;
        while (Date.now() < verifyDeadline) {
          await delay(250);
          if (await this.isPresetChipApplied(cdp, presetName)) return;
        }
      }

      await delay(300);
    }
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

    const files = references.map((reference) => reference.path);
    const before = await this.attachmentSnapshot(cdp);

    await cdp.send("DOM.enable").catch(() => undefined);
    await cdp.send("DOM.getDocument").catch(() => undefined);

    let nodeId = await this.findFileInputNode(cdp);
    let backendNodeId: number | null = null;

    if (!nodeId) {
      await cdp.send("Page.setInterceptFileChooserDialog", { enabled: true });
      try {
        const chooserNode = new Promise<number | null>((resolve) => {
          let settled = false;
          const finish = (value: number | null) => {
            if (settled) return;
            settled = true;
            unsubscribe();
            resolve(value);
          };
          const unsubscribe = cdp.on<{ backendNodeId?: number }>("Page.fileChooserOpened", (event) => {
            finish(
              typeof event.backendNodeId === "number" && event.backendNodeId > 0
                ? event.backendNodeId
                : null,
            );
          });
          setTimeout(() => finish(null), 5_000);
        });

        await this.revealFileInput(cdp);
        backendNodeId = await chooserNode;
      } finally {
        await cdp.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => undefined);
      }
    }

    if (!backendNodeId && !nodeId) {
      const deadline = Date.now() + 2_000;
      while (!nodeId && Date.now() < deadline) {
        nodeId = await this.findFileInputNode(cdp);
        if (!nodeId) await delay(100);
      }
    }

    if (!backendNodeId && !nodeId) {
      throw geminiError(
        "GEMINI_REFERENCE_UPLOAD_CONTROL_NOT_FOUND",
        "NarrativeX could not find Gemini's image attachment input.",
      );
    }

    const fileInputTarget = backendNodeId ? { backendNodeId } : { nodeId };
    await cdp.send("DOM.setFileInputFiles", {
      files,
      ...fileInputTarget,
    });

    const deadline = Date.now() + REFERENCE_UPLOAD_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const snapshot = await this.attachmentSnapshot(cdp);
      if (snapshot.error) throw geminiError("GEMINI_REFERENCE_UPLOAD_FAILED", snapshot.error);
      if (
        snapshot.attachmentCount >= before.attachmentCount + references.length &&
        !snapshot.uploading
      ) {
        await delay(800);
        return;
      }
      if (snapshot.sendEnabled && !snapshot.uploading && Date.now() + 2_000 >= deadline) return;
      await delay(250);
    }
    throw geminiError(
      "GEMINI_REFERENCE_UPLOAD_TIMEOUT",
      "Gemini did not finish attaching the character reference images in time.",
    );
  }

  private async findFileInputNode(cdp: CdpClient): Promise<number | null> {
    await cdp.send("DOM.enable").catch(() => undefined);
    await cdp.send("DOM.getDocument").catch(() => undefined);
    const evaluated = await cdp.send<{ result?: { objectId?: string } }>("Runtime.evaluate", {
      expression:
        `(() => { const inputs = [...document.querySelectorAll('input[type="file"]')]; ` +
        `return inputs.find((input) => !input.disabled) || inputs.at(-1) || null; })()`,
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
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8 && !element.disabled;
        };
        const dispatchClick = (el) => {
          const opts = { bubbles: true, cancelable: true, composed: true, view: window };
          el.dispatchEvent(new PointerEvent("pointerdown", opts));
          el.dispatchEvent(new MouseEvent("mousedown", opts));
          el.dispatchEvent(new PointerEvent("pointerup", opts));
          el.dispatchEvent(new MouseEvent("mouseup", opts));
          el.dispatchEvent(new MouseEvent("click", opts));
        };

        const buttons = [...document.querySelectorAll('.input-area button, form button, .composer button, button')].filter(visible);
        const uploadBtn = buttons.find(b => {
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          return aria.includes('tải lên và công cụ') || aria.includes('nội dung tải lên') || aria.includes('uploads and tools');
        }) || buttons.find(b => {
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          return (aria.includes('tải lên') || aria.includes('upload') || aria.includes('attach') || aria.includes('đính kèm')) && !aria.includes('spark');
        });

        if (!uploadBtn) return false;
        dispatchClick(uploadBtn);
        return true;
      })()`,
    );
    if (!clicked) return;
    await delay(500);
    if (await this.findFileInputNode(cdp)) return;
    await evaluate(
      cdp,
      `(() => {
        const dispatchClick = (el) => {
          const opts = { bubbles: true, cancelable: true, composed: true, view: window };
          el.dispatchEvent(new PointerEvent("pointerdown", opts));
          el.dispatchEvent(new MouseEvent("mousedown", opts));
          el.dispatchEvent(new PointerEvent("pointerup", opts));
          el.dispatchEvent(new MouseEvent("mouseup", opts));
          el.dispatchEvent(new MouseEvent("click", opts));
        };
        const items = [...document.querySelectorAll('[role="menuitem"], [role="option"], button, mat-list-item')].filter(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        });
        const target = items.find(el => {
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const text = (el.innerText || '').toLowerCase();
          return aria.includes('tải tệp lên') || text.includes('tải tệp lên') || aria.includes('upload file') || text.includes('upload file');
        });
        if (!target) return false;
        dispatchClick(target);
        return true;
      })()`,
    );
    await delay(350);
  }

  private async attachmentSnapshot(cdp: CdpClient): Promise<{
    attachmentCount: number;
    uploading: boolean;
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
          '[aria-label*="xóa" i]', '[aria-label*="tệp" i]', '[aria-label*="đính kèm" i]',
          '[data-test-id*="attachment" i]', '[data-testid*="attachment" i]', 'img[src^="blob:"]',
          '.attachment-container', '.file-preview', '.image-preview', 'uploader-file-preview', 'gem-style-attachment'
        ];
        const attachments = new Set();
        for (const selector of attachmentSelectors) {
          for (const element of document.querySelectorAll(selector)) {
            if (visible(element)) attachments.add(element);
          }
        }
        const spinners = [...document.querySelectorAll('mat-progress-spinner, mat-progress-bar, [role="progressbar"], .loading, .uploading')].filter(visible);
        const uploading = spinners.length > 0;

        const sendWords = ["send", "submit", "gửi", "gửi tin nhắn", "send message"];
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
        return { attachmentCount: attachments.size, uploading, sendEnabled, error };
      })()`,
    );
  }

  private async submitPrompt(cdp: CdpClient, prompt: string): Promise<void> {
    const focused = await evaluate<boolean>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
        };
        const candidates = [
          ...document.querySelectorAll('.ql-editor, rich-textarea [contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], textarea, input[type="text"]')
        ].filter((element) => visible(element));

        const score = (element) => {
          const value = [element.getAttribute("placeholder"), element.getAttribute("aria-label")]
            .filter(Boolean).join(" ").replace(/\\s+/g, " ").trim().toLowerCase();
          if (value.includes("mô tả hình ảnh") || value.includes("describe your image") || value.includes("thêm ảnh và mô tả") || value.includes("mô tả các thay đổi") || value.includes("nhập câu lệnh")) return 100;
          if (element.classList && element.classList.contains("ql-editor")) return 80;
          if (element.getAttribute("role") === "textbox") return 50;
          return 0;
        };
        const editor = candidates.sort((a, b) => score(b) - score(a)).at(0);
        if (!editor) return false;

        editor.focus();
        const opts = { bubbles: true, cancelable: true, view: window };
        editor.dispatchEvent(new MouseEvent("mousedown", opts));
        editor.dispatchEvent(new MouseEvent("mouseup", opts));
        editor.dispatchEvent(new MouseEvent("click", opts));

        if (editor.getAttribute("contenteditable") === "true") {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("delete", false, null);

          const success = document.execCommand("insertText", false, ${JSON.stringify(prompt)});
          if (!success || !editor.innerText.trim()) {
            editor.replaceChildren(document.createTextNode(${JSON.stringify(prompt)}));
          }
          editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${JSON.stringify(prompt)} }));
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return true;
      })()`,
    );
    if (!focused) {
      throw geminiError("GEMINI_UI_CHANGED", "NarrativeX could not find the Gemini image prompt editor.");
    }

    await cdp.send("Input.insertText", { text: prompt }).catch(() => undefined);
    await delay(400);

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const sendResult = await evaluate<{ isEditorEmpty: boolean; hasStopBtn: boolean }>(
        cdp,
        `(() => {
          const visible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
          };
          const dispatchClick = (el) => {
            const opts = { bubbles: true, cancelable: true, composed: true, view: window };
            el.dispatchEvent(new PointerEvent("pointerdown", opts));
            el.dispatchEvent(new MouseEvent("mousedown", opts));
            el.dispatchEvent(new PointerEvent("pointerup", opts));
            el.dispatchEvent(new MouseEvent("mouseup", opts));
            el.dispatchEvent(new MouseEvent("click", opts));
          };
          const patterns = ["send", "submit", "gửi", "gửi tin nhắn", "send message"];
          const button = [...document.querySelectorAll('button')].find((candidate) => {
            if (!visible(candidate) || candidate.disabled) return false;
            const value = [candidate.getAttribute("aria-label"), candidate.getAttribute("title"), candidate.textContent]
              .filter(Boolean).join(" ").replace(/\\s+/g, " ").trim().toLowerCase();
            return patterns.some((pattern) => value === pattern || value.includes(pattern));
          });
          if (button) {
            dispatchClick(button);
          }

          const editor = document.querySelector('.ql-editor, [contenteditable="true"]');
          const isEditorEmpty = !editor || !editor.innerText.trim();
          const hasStopBtn = !document.querySelector('button[aria-label*="dừng" i], button[aria-label*="stop" i]');

          return { isEditorEmpty, hasStopBtn };
        })()`,
      );

      if (sendResult.hasStopBtn || sendResult.isEditorEmpty) {
        return;
      }

      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
      });
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
      });
      await delay(500);
    }
  }

  private async generationSnapshot(cdp: CdpClient): Promise<GenerationSnapshot> {
    return evaluate<GenerationSnapshot>(
      cdp,
      `(() => {
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width >= 96 && rect.height >= 96;
        };
        const images = [...document.querySelectorAll(${JSON.stringify(GEMINI_GENERATED_IMAGE_SELECTOR)})]
          .filter((image) => visible(image) && image.naturalWidth >= 256 && image.naturalHeight >= 256);
        const imageSources = [...new Set(images.map((image) => image.currentSrc || image.src || "").filter(Boolean))];
        const text = (document.body?.innerText || "").toLowerCase();
        const blocked = text.includes("can't generate") || text.includes("cannot generate") ||
          text.includes("không thể tạo") || text.includes("unable to generate");
        return { generatedImageCount: imageSources.length, imageSources, blocked };
      })()`,
    );
  }

  private async waitForGeneratedImage(cdp: CdpClient, baseline: GenerationSnapshot): Promise<void> {
    const deadline = Date.now() + GENERATION_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const state = await this.generationSnapshot(cdp);
      if (state.blocked) {
        throw geminiError(
          "GEMINI_GENERATION_REJECTED",
          "Gemini did not generate an image for this Visual Beat.",
        );
      }
      if (hasCompletedGeminiGeneration(baseline, state) || hasFreshImageSource(baseline, state)) {
        await delay(800);
        return;
      }
      await delay(500);
    }
    throw geminiError("GEMINI_GENERATION_TIMEOUT", "Gemini image generation did not finish in time.");
  }

  private async freshDomImages(cdp: CdpClient, baseline: GenerationSnapshot): Promise<DomImage[]> {
    return evaluate<DomImage[]>(
      cdp,
      `(() => {
        const baseline = new Set(${JSON.stringify(baseline.imageSources)});
        return [...document.querySelectorAll(${JSON.stringify(GEMINI_GENERATED_IMAGE_SELECTOR)})]
          .filter((image) => {
            const style = window.getComputedStyle(image);
            const rect = image.getBoundingClientRect();
            const src = image.currentSrc || image.src || "";
            return src && !baseline.has(src) && style.display !== "none" && style.visibility !== "hidden" &&
              rect.width >= 96 && rect.height >= 96 && image.naturalWidth >= 256 && image.naturalHeight >= 256;
          })
          .map((image) => ({ src: image.currentSrc || image.src || "", area: image.naturalWidth * image.naturalHeight }));
      })()`,
    );
  }

  private async persistCapturedImage(
    bytes: Buffer,
    mimeType: string,
    url: string,
    downloadDirectory: string,
  ): Promise<string | null> {
    const extension = imageExtensionForMimeType(mimeType) ?? extensionForUrl(url);
    if (!extension || bytes.length === 0 || bytes.length > MAX_CAPTURE_BYTES) return null;
    const sourcePath = join(
      downloadDirectory,
      `gemini-network-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}${extension}`,
    );
    await writeFile(sourcePath, bytes);
    const file = await stat(sourcePath);
    return file.isFile() && file.size === bytes.length ? sourcePath : null;
  }

  private async captureGeneratedImageFallback(
    cdp: CdpClient,
    baseline: GenerationSnapshot,
    beforeDownload: Set<string>,
    downloadDirectory: string,
  ): Promise<string> {
    if (await this.downloadVisibleGeneratedImage(cdp, baseline)) {
      try {
        return await this.waitForDownloadedImage(beforeDownload, downloadDirectory);
      } catch {
        // Gemini may block an in-page fetch. Screenshot fallback below still keeps the beat usable.
      }
    }

    const screenshotPath = await this.captureVisibleGeneratedImage(cdp, baseline, downloadDirectory);
    if (screenshotPath) return screenshotPath;

    throw geminiError(
      "GEMINI_IMAGE_CAPTURE_FAILED",
      "Gemini generated an image, but NarrativeX could not download or capture it.",
    );
  }

  private async downloadVisibleGeneratedImage(
    cdp: CdpClient,
    baseline: GenerationSnapshot,
  ): Promise<boolean> {
    return evaluate<boolean>(
      cdp,
      `(async () => {
        const baseline = new Set(${JSON.stringify(baseline.imageSources)});
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width >= 96 && rect.height >= 96;
        };
        const images = [...document.querySelectorAll(${JSON.stringify(GEMINI_GENERATED_IMAGE_SELECTOR)})]
          .filter((image) => {
            const src = image.currentSrc || image.src || "";
            return src && !baseline.has(src) && visible(image) && image.naturalWidth >= 256 && image.naturalHeight >= 256;
          });
        const image = images.at(-1);
        if (!image) return false;
        const source = image.currentSrc || image.src || "";
        if (!source || source.startsWith("data:")) return false;
        try {
          const response = await fetch(source, { credentials: "include" });
          if (!response.ok) return false;
          const blob = await response.blob();
          if (blob.size === 0 || blob.size > ${MAX_CAPTURE_BYTES}) return false;
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
    downloadDirectory: string,
  ): Promise<string | null> {
    const clip = await evaluate<{ x: number; y: number; width: number; height: number; scale: number } | null>(
      cdp,
      `(() => {
        const baseline = new Set(${JSON.stringify(baseline.imageSources)});
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width >= 96 && rect.height >= 96;
        };
        const images = [...document.querySelectorAll(${JSON.stringify(GEMINI_GENERATED_IMAGE_SELECTOR)})]
          .filter((image) => {
            const src = image.currentSrc || image.src || "";
            return src && !baseline.has(src) && visible(image) && image.naturalWidth >= 256 && image.naturalHeight >= 256;
          });
        const image = images.at(-1);
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
    if (!clip || clip.width <= 0 || clip.height <= 0) return null;

    const screenshot = await cdp.send<{ data?: string }>("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip,
    });
    if (!screenshot?.data) return null;

    const fallbackPath = join(downloadDirectory, `gemini-image-fallback-${Date.now()}.png`);
    const bytes = Buffer.from(screenshot.data, "base64");
    if (bytes.length === 0 || bytes.length > MAX_CAPTURE_BYTES) return null;
    await writeFile(fallbackPath, bytes);
    return fallbackPath;
  }

  private async snapshotDownloads(downloadDirectory: string): Promise<Set<string>> {
    const entries = await readdir(downloadDirectory, { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  }

  private async waitForDownloadedImage(before: Set<string>, downloadDirectory: string): Promise<string> {
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
        if (!file.isFile() || file.size === 0 || file.size > MAX_CAPTURE_BYTES) continue;
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
    const value = await this.readPersistedSession();
    return value && Number.isInteger(value.port) && Number(value.port) > 0 ? Number(value.port) : null;
  }

  private async readPersistedSession(): Promise<Partial<PersistedSession> | null> {
    try {
      const value = JSON.parse(await readFile(this.sessionFile, "utf8")) as Partial<PersistedSession>;
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  private async writePersistedSession(): Promise<void> {
    if (!this.port) return;
    const port = this.port;
    const targets = Object.fromEntries(
      [...this.lanes.entries()]
        .filter(([, lane]) => lane.targetId)
        .map(([lane, state]) => [lane, state.targetId as string]),
    ) as Partial<Record<GeminiWebLane, string>>;
    const write = this.sessionWritePromise.then(() =>
      writeFile(this.sessionFile, JSON.stringify({ port, targets } satisfies PersistedSession), "utf8"),
    );
    this.sessionWritePromise = write.then(() => undefined, () => undefined);
    await write;
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

function hasFreshImageSource(baseline: GenerationSnapshot, current: GenerationSnapshot): boolean {
  const previous = new Set(baseline.imageSources.filter(Boolean));
  return current.imageSources.some((source) => source && !previous.has(source));
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
  return new Promise<number>((resolve, reject) => {
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
