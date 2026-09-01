import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  GeminiWebAutomation,
  type GeminiWebGenerationResult,
  type GeminiWebReferenceFile,
} from "./gemini-web-automation.ts";
import { GeminiWebSlotPool } from "./gemini-web-slot-pool.ts";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes.ts";

const SHARED_PORT_TIMEOUT_MS = 20_000;

type TabCounts = {
  characterTabs: number;
  storyboardTabs: number;
};

type AutomationLike = {
  generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references?: readonly GeminiWebReferenceFile[],
  ): Promise<GeminiWebGenerationResult>;
  stop(): Promise<void>;
};

type AutomationFactory = (rootDirectory: string) => AutomationLike;

type Slot = {
  rootDirectory: string;
  automation: AutomationLike;
  primary: boolean;
};

type LanePoolState = {
  capacity: number;
  pool: GeminiWebSlotPool<Slot>;
  activeLeases: number;
};

export class GeminiWebAutomationPool {
  private readonly primaryAutomation: AutomationLike;
  private readonly primarySessionFile: string;
  private readonly lanes = new Map<GeminiWebLane, LanePoolState>();

  constructor(
    private readonly rootDirectory: string,
    private readonly getTabCounts: () => Promise<TabCounts>,
    private readonly createAutomation: AutomationFactory = (root) => new GeminiWebAutomation(root),
  ) {
    this.primaryAutomation = this.createAutomation(rootDirectory);
    this.primarySessionFile = join(rootDirectory, "session.json");
  }

  async generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references: readonly GeminiWebReferenceFile[] = [],
  ): Promise<GeminiWebGenerationResult> {
    const counts = await this.getTabCounts();
    const capacity = lane === "CHARACTER" ? counts.characterTabs : counts.storyboardTabs;
    const state = this.poolFor(lane, capacity);
    const lease = await state.pool.acquire();
    state.activeLeases += 1;
    try {
      if (!lease.slot.primary) {
        await this.seedSecondarySession(lease.slot.rootDirectory);
      }
      return await lease.slot.automation.generateImage(lane, prompt, references);
    } finally {
      state.activeLeases = Math.max(0, state.activeLeases - 1);
      lease.release();
    }
  }

  async stop(): Promise<void> {
    await this.primaryAutomation.stop();
    this.lanes.clear();
  }

  private poolFor(lane: GeminiWebLane, capacity: number): LanePoolState {
    const current = this.lanes.get(lane);
    if (current && (current.capacity === capacity || current.activeLeases > 0)) return current;

    const laneDirectory = lane.toLowerCase();
    const pool = new GeminiWebSlotPool<Slot>(capacity, (index) => {
      if (index === 0) {
        return {
          rootDirectory: this.rootDirectory,
          automation: this.primaryAutomation,
          primary: true,
        };
      }
      const rootDirectory = join(this.rootDirectory, "slots", laneDirectory, String(index));
      return {
        rootDirectory,
        automation: this.createAutomation(rootDirectory),
        primary: false,
      };
    });
    const next = { capacity, pool, activeLeases: 0 };
    this.lanes.set(lane, next);
    return next;
  }

  private async seedSecondarySession(slotRoot: string): Promise<void> {
    const deadline = Date.now() + SHARED_PORT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const persisted = JSON.parse(await readFile(this.primarySessionFile, "utf8")) as {
          port?: unknown;
        };
        if (Number.isInteger(persisted.port) && Number(persisted.port) > 0) {
          const sessionFile = join(slotRoot, "session.json");
          await mkdir(dirname(sessionFile), { recursive: true });
          await writeFile(
            sessionFile,
            `${JSON.stringify({ port: Number(persisted.port) }, null, 2)}\n`,
            "utf8",
          );
          return;
        }
      } catch {
        // Slot zero creates the shared Chrome session. Secondary slots wait for it.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Gemini shared Chrome session was not ready for a parallel tab.");
  }
}
