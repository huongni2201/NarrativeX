import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GeminiWebAutomation } from "./gemini-web-automation.ts";
import type {
  GeminiPoolAutomation,
  GeminiPoolGenerationResult,
  GeminiPoolReferenceFile,
} from "./gemini-web-automation-pool.ts";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes.ts";

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
    const port = await this.requireLiveSharedPort();
    if (!(await devToolsAvailable(port))) {
      throw new Error(
        "Gemini shared Chrome session is unavailable. Reopen the configured Gemini browser instead of starting a new Chrome profile.",
      );
    }
    return this.delegate.generateImage(lane, prompt, references);
  }

  async stop(): Promise<void> {
    // Secondary slots never own the browser process. The primary automation/host stops it.
  }

  private async requireLiveSharedPort(): Promise<number> {
    try {
      const persisted = JSON.parse(await readFile(this.sessionFile, "utf8")) as PersistedSession;
      if (Number.isInteger(persisted.port) && Number(persisted.port) > 0) {
        return Number(persisted.port);
      }
    } catch {
      // Fall through to the shared-session error below.
    }
    throw new Error(
      "Gemini shared Chrome session is unavailable. Reopen the configured Gemini browser instead of starting a new Chrome profile.",
    );
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
