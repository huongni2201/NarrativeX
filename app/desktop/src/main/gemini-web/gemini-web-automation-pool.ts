import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { GeminiWebSlotPool } from "./gemini-web-slot-pool.ts";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes.ts";

const SHARED_PORT_TIMEOUT_MS = 20_000;

type TabCounts = {
  characterTabs: number;
  storyboardTabs: number;
};

type PersistedPoolSession = {
  port?: number;
  targets?: Partial<Record<GeminiWebLane, string>>;
};

export function mergeSharedPortSession(
  current: PersistedPoolSession | null | undefined,
  port: number,
): PersistedPoolSession {
  return {
    port,
    ...(current?.targets ? { targets: { ...current.targets } } : {}),
  };
}

export interface GeminiPoolReferenceFile {
  path: string;
  refLabel: string;
  canonicalName: string;
  characterId: string;
  beatRole?: string | null;
}

export interface GeminiPoolGenerationResult {
  sourcePath: string;
  captureMethod: "NETWORK" | "DOWNLOAD";
}

export interface GeminiPoolAutomation {
  generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references?: readonly GeminiPoolReferenceFile[],
  ): Promise<GeminiPoolGenerationResult>;
  stop(): Promise<void>;
}

export type GeminiPoolAutomationFactory = (rootDirectory: string) => GeminiPoolAutomation;

type Slot = {
  rootDirectory: string;
  automation: GeminiPoolAutomation;
  primary: boolean;
};

type LanePoolState = {
  capacity: number;
  pool: GeminiWebSlotPool<Slot>;
  activeLeases: number;
};

export class GeminiWebAutomationPool {
  private readonly primaryAutomation: GeminiPoolAutomation;
  private readonly primarySessionFile: string;
  private readonly lanes = new Map<GeminiWebLane, LanePoolState>();

  constructor(
    private readonly rootDirectory: string,
    private readonly getTabCounts: () => Promise<TabCounts>,
    private readonly createAutomation: GeminiPoolAutomationFactory,
  ) {
    this.primaryAutomation = this.createAutomation(rootDirectory);
    this.primarySessionFile = join(rootDirectory, "session.json");
  }

  async generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references: readonly GeminiPoolReferenceFile[] = [],
  ): Promise<GeminiPoolGenerationResult> {
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
          let current: PersistedPoolSession | null = null;
          try {
            const parsed = JSON.parse(await readFile(sessionFile, "utf8")) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const candidate = parsed as PersistedPoolSession;
              current = {
                ...(Number.isInteger(candidate.port) ? { port: candidate.port } : {}),
                ...(candidate.targets && typeof candidate.targets === "object"
                  ? { targets: { ...candidate.targets } }
                  : {}),
              };
            }
          } catch {
            // A missing or malformed secondary session is safe to rebuild from the shared port.
          }
          await mkdir(dirname(sessionFile), { recursive: true });
          await writeFile(
            sessionFile,
            `${JSON.stringify(mergeSharedPortSession(current, Number(persisted.port)), null, 2)}\n`,
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
