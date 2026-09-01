import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { delimiter, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  GeminiBrowserCdpClient,
  evaluateBrowserPage,
} from "./gemini-browser-cdp.ts";

const GEMINI_URL = "https://gemini.google.com/app";
const CHROME_START_TIMEOUT_MS = 20_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const CONTROL_TARGET_FILE = "browser-control.json";
const BACKGROUND_FLAGS = [
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion",
] as const;

export type GeminiBrowserAuthStatus = "LOGGED_IN" | "NOT_LOGGED_IN" | "UNAVAILABLE";

export type GeminiAuthSnapshot = {
  composer: boolean;
  signIn: boolean;
};

type DevToolsVersion = {
  webSocketDebuggerUrl?: string;
};

type DevToolsTarget = {
  id?: string;
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type PersistedAutomationSession = {
  port?: number;
  targets?: Record<string, string>;
};

type PersistedControlTarget = {
  targetId?: string;
};

export function classifyGeminiAuthSnapshot(snapshot: GeminiAuthSnapshot): GeminiBrowserAuthStatus {
  if (snapshot.composer) return "LOGGED_IN";
  if (snapshot.signIn) return "NOT_LOGGED_IN";
  return "UNAVAILABLE";
}

export class GeminiBrowserSession {
  private readonly profileDirectory: string;
  private readonly sessionFile: string;
  private readonly controlFile: string;
  private chromeProcess: ChildProcess | null = null;
  private startPromise: Promise<number> | null = null;

  constructor(private readonly rootDirectory: string) {
    this.profileDirectory = join(rootDirectory, "chrome-profile");
    this.sessionFile = join(rootDirectory, "session.json");
    this.controlFile = join(rootDirectory, CONTROL_TARGET_FILE);
  }

  async authStatus(): Promise<GeminiBrowserAuthStatus> {
    try {
      const port = await this.ensureBrowser(true);
      const target = await this.ensureControlTarget(port);
      const cdp = await GeminiBrowserCdpClient.connect(target.webSocketDebuggerUrl as string);
      try {
        await cdp.send("Runtime.enable");
        await cdp.send("Page.enable");
        await this.ensureGeminiLocation(cdp);
        await delay(800);
        return classifyGeminiAuthSnapshot(await this.authSnapshot(cdp));
      } finally {
        cdp.close();
      }
    } catch {
      return "UNAVAILABLE";
    }
  }

  async login(): Promise<GeminiBrowserAuthStatus> {
    const port = await this.ensureBrowser(false);
    const target = await this.ensureControlTarget(port);
    const cdp = await GeminiBrowserCdpClient.connect(target.webSocketDebuggerUrl as string);
    try {
      await cdp.send("Runtime.enable");
      await cdp.send("Page.enable");
      await this.ensureGeminiLocation(cdp);
      await this.bringTargetToFront(cdp);
      const deadline = Date.now() + LOGIN_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const status = classifyGeminiAuthSnapshot(await this.authSnapshot(cdp));
        if (status === "LOGGED_IN") return status;
        await delay(750);
      }
      return "NOT_LOGGED_IN";
    } finally {
      cdp.close();
    }
  }

  async open(): Promise<void> {
    const port = await this.ensureBrowser(false);
    const target = await this.ensureControlTarget(port);
    const cdp = await GeminiBrowserCdpClient.connect(target.webSocketDebuggerUrl as string);
    try {
      await cdp.send("Page.enable");
      await this.ensureGeminiLocation(cdp);
      await this.bringTargetToFront(cdp);
    } finally {
      cdp.close();
    }
  }

  async stop(): Promise<void> {
    const port = await this.readPersistedPort();
    if (port) {
      try {
        const version = await this.fetchJson<DevToolsVersion>(port, "/json/version");
        if (version.webSocketDebuggerUrl) {
          const cdp = await GeminiBrowserCdpClient.connect(version.webSocketDebuggerUrl);
          try {
            await cdp.send("Browser.close");
          } finally {
            cdp.close();
          }
        }
      } catch {
        // Child-process kill below is the final fallback when this controller owns Chrome.
      }
    }
    if (this.chromeProcess && !this.chromeProcess.killed) this.chromeProcess.kill();
    this.chromeProcess = null;
  }

  private async ensureBrowser(startMinimized: boolean): Promise<number> {
    await mkdir(this.profileDirectory, { recursive: true });
    const persistedPort = await this.readPersistedPort();
    if (persistedPort && (await this.devToolsAvailable(persistedPort))) return persistedPort;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startBrowser(startMinimized);
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startBrowser(startMinimized: boolean): Promise<number> {
    const chromePath = await resolveChromeExecutable();
    if (!chromePath) {
      throw new Error("Google Chrome was not found. Install Chrome or set NARRATIVEX_CHROME_PATH to chrome.exe.");
    }
    const port = await findFreePort();
    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${this.profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      ...BACKGROUND_FLAGS,
      ...(startMinimized ? ["--start-minimized"] : []),
      GEMINI_URL,
    ];
    const chrome = spawn(chromePath, args, { stdio: "ignore", windowsHide: false });
    chrome.once("exit", () => {
      if (this.chromeProcess === chrome) this.chromeProcess = null;
    });
    this.chromeProcess = chrome;
    await this.persistPort(port);

    const deadline = Date.now() + CHROME_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (chrome.exitCode !== null) throw new Error("Chrome exited before Gemini browser control could connect.");
      if (await this.devToolsAvailable(port)) return port;
      await delay(250);
    }
    throw new Error("Chrome opened but NarrativeX could not connect to its DevTools endpoint.");
  }

  private async ensureControlTarget(port: number): Promise<DevToolsTarget> {
    const targets = await this.fetchJson<DevToolsTarget[]>(port, "/json");
    const persisted = await this.readControlTarget();
    if (persisted?.targetId) {
      const existing = targets.find(
        (candidate) =>
          candidate.id === persisted.targetId &&
          candidate.type === "page" &&
          typeof candidate.webSocketDebuggerUrl === "string",
      );
      if (existing?.webSocketDebuggerUrl) return existing;
    }

    const created = await this.fetchJson<DevToolsTarget>(
      port,
      `/json/new?${encodeURIComponent(GEMINI_URL)}`,
      "PUT",
    );
    if (!created.id || !created.webSocketDebuggerUrl) {
      throw new Error("Chrome did not expose a Gemini page for browser login management.");
    }
    await writeFile(this.controlFile, JSON.stringify({ targetId: created.id }), "utf8");
    return created;
  }

  private async authSnapshot(cdp: GeminiBrowserCdpClient): Promise<GeminiAuthSnapshot> {
    return evaluateBrowserPage<GeminiAuthSnapshot>(
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
  }

  private async ensureGeminiLocation(cdp: GeminiBrowserCdpClient): Promise<void> {
    const location = await evaluateBrowserPage<string>(cdp, "window.location.href");
    if (location.includes("gemini.google.com")) return;
    await cdp.send("Page.navigate", { url: GEMINI_URL });
    await delay(1_000);
  }

  private async bringTargetToFront(cdp: GeminiBrowserCdpClient): Promise<void> {
    await cdp.send("Page.bringToFront").catch(() => undefined);
    const window = await cdp
      .send<{ windowId?: number }>("Browser.getWindowForTarget")
      .catch(() => null);
    if (window?.windowId) {
      await cdp
        .send("Browser.setWindowBounds", {
          windowId: window.windowId,
          bounds: { windowState: "normal" },
        })
        .catch(() => undefined);
    }
  }

  private async readPersistedPort(): Promise<number | null> {
    try {
      const value = JSON.parse(await readFile(this.sessionFile, "utf8")) as PersistedAutomationSession;
      return Number.isInteger(value?.port) && Number(value.port) > 0 ? Number(value.port) : null;
    } catch {
      return null;
    }
  }

  private async persistPort(port: number): Promise<void> {
    let existing: PersistedAutomationSession = {};
    try {
      const parsed = JSON.parse(await readFile(this.sessionFile, "utf8")) as PersistedAutomationSession;
      if (parsed && typeof parsed === "object") existing = parsed;
    } catch {
      // A missing/malformed session is safe to recreate with a fresh port.
    }
    await writeFile(
      this.sessionFile,
      JSON.stringify({ ...existing, port }),
      "utf8",
    );
  }

  private async readControlTarget(): Promise<PersistedControlTarget | null> {
    try {
      const value = JSON.parse(await readFile(this.controlFile, "utf8")) as PersistedControlTarget;
      return value && typeof value === "object" ? value : null;
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
    for (const root of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (root) candidates.push(join(root, "Google", "Chrome", "Application", "chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    candidates.push(join(process.env.HOME || "", "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"));
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
