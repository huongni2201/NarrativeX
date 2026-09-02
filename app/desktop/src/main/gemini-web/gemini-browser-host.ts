import { GeminiWebAutomation } from "./gemini-web-automation.ts";
import { GeminiWebAttachedAutomation } from "./gemini-web-attached-automation.ts";
import {
  GeminiWebAutomationPool,
  type GeminiPoolGenerationResult,
  type GeminiPoolReferenceFile,
} from "./gemini-web-automation-pool.ts";
import { GeminiBrowserSession } from "./gemini-browser-session.ts";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes.ts";

export type GeminiHostTabCounts = {
  characterTabs: number;
  storyboardTabs: number;
};

export interface GeminiBrowserHostLike {
  readonly browserId: string;
  open(): Promise<void>;
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
      (slotRoot, options) =>
        options.attachOnly
          ? new GeminiWebAttachedAutomation(slotRoot)
          : new GeminiWebAutomation(slotRoot),
    );
  }

  open(): Promise<void> {
    return this.session.open();
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
