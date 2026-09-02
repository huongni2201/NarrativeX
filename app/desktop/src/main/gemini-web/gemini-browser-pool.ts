import type { EffectiveDesktopPreferences, DesktopPreferencesStore } from "../preferences/desktop-preferences.ts";
import type { GeminiBrowserProfile } from "./gemini-browser-registry.ts";
import { GeminiBrowserStorage } from "./gemini-browser-storage.ts";
import { GeminiWebSlotPool } from "./gemini-web-slot-pool.ts";
import type {
  GeminiPoolGenerationResult,
  GeminiPoolReferenceFile,
} from "./gemini-web-automation-pool.ts";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes.ts";

export type GeminiBrowserViewStatus = "LOGGED_IN" | "NOT_LOGGED_IN";

export interface GeminiBrowserView {
  id: string;
  name: string;
  createdAt: string;
  authStatus: GeminiBrowserViewStatus;
  activeLeases: number;
  canRemove: boolean;
}

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

export interface GeminiBrowserPreferenceStore {
  get(): Promise<EffectiveDesktopPreferences>;
  addGeminiBrowser(): Promise<EffectiveDesktopPreferences>;
  setGeminiBrowserLoginConfirmed(
    browserId: string,
    loginConfirmed: boolean,
  ): Promise<EffectiveDesktopPreferences>;
  removeGeminiBrowser(browserId: string): Promise<EffectiveDesktopPreferences>;
}

export type GeminiBrowserHostFactory = (input: {
  userId: string;
  browser: GeminiBrowserProfile;
  rootDirectory: string;
  getTabCounts: () => Promise<{ characterTabs: number; storyboardTabs: number }>;
}) => GeminiBrowserHostLike;

type GlobalLaneState = {
  capacity: number;
  activeLeases: number;
  pool: GeminiWebSlotPool<null>;
};

type BrowserTabCounts = {
  characterTabs: number;
  storyboardTabs: number;
};

function distributedShare(total: number, index: number, browserCount: number): number {
  if (browserCount <= 0 || index < 0 || index >= browserCount) return 0;
  const base = Math.floor(total / browserCount);
  return base + (index < total % browserCount ? 1 : 0);
}

function tabCountsForBrowser(
  preferences: EffectiveDesktopPreferences,
  browserId: string,
): BrowserTabCounts {
  const confirmed = preferences.gemini.browsers.filter((browser) => browser.loginConfirmed);
  const index = confirmed.findIndex((browser) => browser.id === browserId);
  if (index < 0) return { characterTabs: 0, storyboardTabs: 0 };
  return {
    characterTabs: distributedShare(preferences.gemini.characterTabs, index, confirmed.length),
    storyboardTabs: distributedShare(preferences.gemini.storyboardTabs, index, confirmed.length),
  };
}

export class GeminiBrowserPool {
  private readonly storage: GeminiBrowserStorage;
  private readonly hosts = new Map<string, GeminiBrowserHostLike>();
  private readonly laneStates = new Map<GeminiWebLane, GlobalLaneState>();
  private readonly roundRobinCursor = new Map<GeminiWebLane, number>();
  private activeUserId: string | null = null;

  constructor(
    rootDirectory: string,
    private readonly preferences: GeminiBrowserPreferenceStore | DesktopPreferencesStore,
    private readonly createHost: GeminiBrowserHostFactory,
    storage?: GeminiBrowserStorage,
  ) {
    this.storage = storage ?? new GeminiBrowserStorage(rootDirectory);
  }

  async list(): Promise<GeminiBrowserView[]> {
    const preferences = await this.ensureUserContext();
    return preferences.gemini.browsers.map((browser) => {
      const host = this.requireExistingHost(browser.id);
      return {
        id: browser.id,
        name: browser.name,
        createdAt: browser.createdAt,
        authStatus: browser.loginConfirmed ? "LOGGED_IN" : "NOT_LOGGED_IN",
        activeLeases: host.activeLeaseCount(),
        canRemove: preferences.gemini.browsers.length > 1 && host.activeLeaseCount() === 0,
      } satisfies GeminiBrowserView;
    });
  }

  async add(): Promise<GeminiBrowserView[]> {
    await this.preferences.addGeminiBrowser();
    await this.ensureUserContext();
    return this.list();
  }

  async open(browserId: string): Promise<void> {
    const host = await this.requireHost(browserId);
    await host.open();
  }

  async setLoginConfirmed(
    browserId: string,
    loginConfirmed: boolean,
  ): Promise<GeminiBrowserView[]> {
    await this.ensureUserContext();
    await this.preferences.setGeminiBrowserLoginConfirmed(browserId, loginConfirmed);
    return this.list();
  }

  async resetLogin(browserId: string): Promise<GeminiBrowserView[]> {
    const preferences = await this.ensureUserContext();
    const host = this.requireExistingHost(browserId);
    if (host.activeLeaseCount() > 0) {
      throw new Error("This Gemini browser is generating an image. Wait for its active generation to finish before resetting login.");
    }
    await host.stop();
    await this.storage.resetLogin(preferences.userId, browserId);
    await this.preferences.setGeminiBrowserLoginConfirmed(browserId, false);
    this.hosts.delete(browserId);
    await this.ensureUserContext();
    return this.list();
  }

  async remove(browserId: string): Promise<GeminiBrowserView[]> {
    const preferences = await this.ensureUserContext();
    if (preferences.gemini.browsers.length <= 1) {
      throw new Error("At least one Gemini browser must remain.");
    }
    const host = this.requireExistingHost(browserId);
    if (host.activeLeaseCount() > 0) {
      throw new Error("This Gemini browser is generating an image. Wait for its active generation to finish before removing it.");
    }
    await host.stop();
    await this.preferences.removeGeminiBrowser(browserId);
    await this.storage.removeBrowserData(preferences.userId, browserId);
    this.hosts.delete(browserId);
    return this.list();
  }

  async generateImage(
    lane: GeminiWebLane,
    prompt: string,
    references: readonly GeminiPoolReferenceFile[] = [],
  ): Promise<GeminiPoolGenerationResult> {
    const preferences = await this.ensureUserContext();
    const capacity = lane === "CHARACTER"
      ? preferences.gemini.characterTabs
      : preferences.gemini.storyboardTabs;
    const state = this.globalLanePool(lane, capacity);
    const lease = await state.pool.acquire();
    state.activeLeases += 1;
    try {
      const host = this.selectConfirmedHost(lane, preferences);
      try {
        return await host.generateImage(lane, prompt, references);
      } catch (error) {
        if (error instanceof Error && error.name === "GEMINI_AUTH_REQUIRED") {
          await this.preferences.setGeminiBrowserLoginConfirmed(host.browserId, false);
        }
        throw error;
      }
    } finally {
      state.activeLeases = Math.max(0, state.activeLeases - 1);
      lease.release();
    }
  }

  async stop(): Promise<void> {
    const hosts = [...this.hosts.values()];
    this.hosts.clear();
    this.laneStates.clear();
    this.roundRobinCursor.clear();
    this.activeUserId = null;
    await Promise.allSettled(hosts.map((host) => host.stop()));
  }

  private async ensureUserContext(): Promise<EffectiveDesktopPreferences> {
    const preferences = await this.preferences.get();
    if (this.activeUserId !== preferences.userId) {
      const previousHosts = [...this.hosts.values()];
      this.hosts.clear();
      this.laneStates.clear();
      this.roundRobinCursor.clear();
      await Promise.allSettled(previousHosts.map((host) => host.stop()));
      this.activeUserId = preferences.userId;
      await this.storage.migrateLegacyBrowserOne(preferences.userId);
    }
    this.syncHosts(preferences);
    return preferences;
  }

  private syncHosts(preferences: EffectiveDesktopPreferences): void {
    const liveIds = new Set(preferences.gemini.browsers.map((browser) => browser.id));
    for (const browserId of this.hosts.keys()) {
      if (!liveIds.has(browserId)) this.hosts.delete(browserId);
    }
    for (const browser of preferences.gemini.browsers) {
      if (this.hosts.has(browser.id)) continue;
      const rootDirectory = this.storage.browserRoot(preferences.userId, browser.id);
      const getTabCounts = async () => {
        const current = await this.preferences.get();
        return tabCountsForBrowser(current, browser.id);
      };
      this.hosts.set(
        browser.id,
        this.createHost({
          userId: preferences.userId,
          browser,
          rootDirectory,
          getTabCounts,
        }),
      );
    }
  }

  private async requireHost(browserId: string): Promise<GeminiBrowserHostLike> {
    await this.ensureUserContext();
    return this.requireExistingHost(browserId);
  }

  private requireExistingHost(browserId: string): GeminiBrowserHostLike {
    const host = this.hosts.get(browserId);
    if (!host) throw new Error("Gemini browser was not found.");
    return host;
  }

  private globalLanePool(lane: GeminiWebLane, capacity: number): GlobalLaneState {
    const current = this.laneStates.get(lane);
    if (current && (current.capacity === capacity || current.activeLeases > 0)) return current;
    const next: GlobalLaneState = {
      capacity,
      activeLeases: 0,
      pool: new GeminiWebSlotPool<null>(capacity, () => null),
    };
    this.laneStates.set(lane, next);
    return next;
  }

  private selectConfirmedHost(
    lane: GeminiWebLane,
    preferences: EffectiveDesktopPreferences,
  ): GeminiBrowserHostLike {
    const confirmed = preferences.gemini.browsers.filter((browser) => browser.loginConfirmed);
    if (!confirmed.length) {
      throw new Error(
        "No Gemini browser is marked as signed in. Open Desktop Settings, open a browser, sign in to Google, then confirm that it is logged in.",
      );
    }

    const eligible = confirmed
      .map((browser) => {
        const host = this.requireExistingHost(browser.id);
        const counts = tabCountsForBrowser(preferences, browser.id);
        const quota = lane === "CHARACTER" ? counts.characterTabs : counts.storyboardTabs;
        return { host, load: host.activeLeaseCount(), quota };
      })
      .filter((candidate) => candidate.quota > 0);

    const minimumLoad = Math.min(...eligible.map((candidate) => candidate.load));
    const leastActive = eligible.filter((candidate) => candidate.load === minimumLoad);
    const cursor = this.roundRobinCursor.get(lane) ?? 0;
    const selected = leastActive[cursor % leastActive.length];
    this.roundRobinCursor.set(lane, cursor + 1);
    return selected.host;
  }
}
