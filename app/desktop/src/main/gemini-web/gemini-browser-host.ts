import { GeminiWebAutomation } from "./gemini-web-automation";
import {
  GeminiWebAutomationPool,
  type GeminiPoolGenerationResult,
  type GeminiPoolReferenceFile,
} from "./gemini-web-automation-pool";
import {
  GeminiBrowserSession,
  type GeminiBrowserAuthStatus,
} from "./gemini-browser-session";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes";

export type GeminiHostTabCounts = {
  characterTabs: number;
  storyboardTabs: number;
};

export interface GeminiBrowserHostLike {
  readonly browserId: string;
  authStatus(): Promise<GeminiBrowserAuthStatus>;
  open(): Promise<void>;
  login(): Promise<GeminiBrowserAuthStatus>;
  generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references?: readonly GeminiPoolReferenceFile[],
  ): Promise<GeminiPoolGenerationResult>;
  activeLeaseCount(): number;
  stop(): Promise<void>;
}

export class GeminiBrowserHost implements GeminiBrowserHostLike {
  private readonly session: GeminiBrowserSession;
  private readonly automation: GeminiWebAutomationPool;
  private activeLeases = 0;

  constructor(
    readonly browserId: string,
    rootDirectory: string,
    getTabCounts: () => Promise<GeminiHostTabCounts>,
  ) {
    this.session = new GeminiBrowserSession(rootDirectory);
    this.automation = new GeminiWebAutomationPool(
      rootDirectory,
      getTabCounts,
      (slotRoot) => new GeminiWebAutomation(slotRoot),
    );
  }

  authStatus(): Promise<GeminiBrowserAuthStatus> {
    return this.session.authStatus();
  }

  open(): Promise<void> {
    return this.session.open();
  }

  login(): Promise<GeminiBrowserAuthStatus> {
    return this.session.login();
  }

  async generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references: readonly GeminiPoolReferenceFile[] = [],
  ): Promise<GeminiPoolGenerationResult> {
    this.activeLeases += 1;
    try {
      return await this.automation.generateImage(lane, prompt, references);
    } finally {
      this.activeLeases = Math.max(0, this.activeLeases - 1);
    }
  }

  activeLeaseCount(): number {
    return this.activeLeases;
  }

  async stop(): Promise<void> {
    await this.automation.stop().catch(() => undefined);
    await this.session.stop().catch(() => undefined);
  }
}
