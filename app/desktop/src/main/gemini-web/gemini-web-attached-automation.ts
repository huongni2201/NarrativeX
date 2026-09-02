import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { GeminiWebAutomation } from "./gemini-web-automation.ts";
import type {
  GeminiPoolAutomation,
  GeminiPoolGenerationResult,
  GeminiPoolReferenceFile,
} from "./gemini-web-automation-pool.ts";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes.ts";

const SHARED_CHROME_TIMEOUT_MS = 20_000;

type PersistedSession = {
  port?: unknown;
};

type DevToolsVersion = {
  webSocketDebuggerUrl?: unknown;
};

export class GeminiWebAttachedAutomation implements GeminiPoolAutomation {
  private readonly delegate: GeminiWebAutomation;
  private readonly sessionFile: string;

  constructor(rootDirectory: string) {
    this.delegate = new GeminiWebAutomation(rootDirectory);
    this.sessionFile = join(rootDirectory, "session.json");
  }

  async generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references: readonly GeminiPoolReferenceFile[] = [],
  ): Promise<GeminiPoolGenerationResult> {
    await this.waitForLiveSharedChrome();
    return this.delegate.generateImage(lane, prompt, references);
  }

  async stop(): Promise<void> {
    // Secondary slots never own the browser process. The primary automation/host stops it.
  }

  private async waitForLiveSharedChrome(): Promise<void> {
    const deadline = Date.now() + SHARED_CHROME_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const port = await this.readSharedPort();
      if (port && (await devToolsAvailable(port))) return;
      await delay(50);
    }
    throw new Error(
      "Gemini shared Chrome session is unavailable. Reopen the configured Gemini browser instead of starting a new Chrome profile.",
    );
  }

  private async readSharedPort(): Promise<number | null> {
    try {
      const persisted = JSON.parse(await readFile(this.sessionFile, "utf8")) as PersistedSession;
      return Number.isInteger(persisted.port) && Number(persisted.port) > 0
        ? Number(persisted.port)
        : null;
    } catch {
      return null;
    }
  }
}

async function devToolsAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return false;
    const version = (await response.json()) as DevToolsVersion;
    return typeof version.webSocketDebuggerUrl === "string";
  } catch {
    return false;
  }
}
