import type { EffectiveDesktopPreferences, DesktopPreferencesStore } from "../preferences/desktop-preferences.ts";
import type { GeminiBrowserProfile } from "./gemini-browser-registry.ts";
import { GeminiBrowserStorage } from "./gemini-browser-storage.ts";
import {
  GeminiBrowserHost,
  type GeminiBrowserHostLike,
} from "./gemini-browser-host.ts";
import { GeminiWebSlotPool } from "./gemini-web-slot-pool.ts";
import type {
  GeminiPoolGenerationResult,
  GeminiPoolReferenceFile,
} from "./gemini-web-automation-pool.ts";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes.ts";
import type { GeminiBrowserAuthStatus } from "./gemini-browser-session.ts";

export type GeminiBrowserViewStatus = "CHECKING" | GeminiBrowserAuthStatus;

export interface GeminiBrowserView {
  id: string;
  name: string;
  createdAt: string;
  authStatus: GeminiBrowserViewStatus;
  activeLeases: number;
  canRemove: boolean;
}

export interface GeminiBrowserPreferenceStore {
  get(): Promise<EffectiveDesktopPreferences>;
  addGeminiBrowser(): Promise<EffectiveDesktopPreferences>;
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

export class GeminiBrowserPool {
  private readonly storage: GeminiBrowserStorage;
  private readonly hosts = new Map<string, GeminiBrowserHostLike>();
  private readonly laneStates = new Map<GeminiWebLane, GlobalLaneState>();
  private readonly roundRobinCursor = new Map<GeminiWebLane, number>();
  private activeUserId: string | null = null;

  constructor(
    rootDirectory: string,
    private readonly preferences: GeminiBrowserPreferenceStore | DesktopPreferencesStore,
    private readonly createHost: GeminiBrowserHostFactory = ({ browser, rootDirectory, getTabCounts }) =>
      new GeminiBrowserHost(browser.id, rootDirectory, getTabCounts),
    storage?: GeminiBrowserStorage,
  ) {
    this.storage = storage ?? new GeminiBrowserStorage(rootDirectory);
  }

  async list(): Promise<GeminiBrowserView[]> {
    const preferences = await this.ensureUserContext();
    const statuses = await Promise.all(
      preferences.gemini.browsers.map(async (browser) => {
        const host = this.hosts.get(browser.id) as GeminiBrowserHostLike;
        const authStatus = await host.authStatus();
        return {
          id: browser.id,
          name: browser.name,
          createdAt: browser.createdAt,
          authStatus,
          activeLeases: host.activeLeaseCount(),
          canRemove: preferences.gemini.browsers.length > 1 && host.activeLeaseCount() === 0,
        } satisfies GeminiBrowserView;
      }),
    );
    return statuses;
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

  async login(browserId: string): Promise<GeminiBrowserView[]> {
    const host = await this.requireHost(browserId);
    const status = await host.login();
    if (status !== "LOGGED_IN") {
      throw new Error("Gemini login was not completed. Finish signing in to Google in the selected browser and try again.");
    }
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
      const host = await this.selectAuthenticatedHost(lane, preferences.gemini.browsers);
      return await host.generateImage(lane, prompt, references);
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
        return {
          characterTabs: current.gemini.characterTabs,
          storyboardTabs: current.gemini.storyboardTabs,
        };
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

  private async selectAuthenticatedHost(
    lane: GeminiWebLane,
    browsers: readonly GeminiBrowserProfile[],
  ): Promise<GeminiBrowserHostLike> {
    const candidates = await Promise.all(
      browsers.map(async (browser) => {
        const host = this.requireExistingHost(browser.id);
        const authStatus = await host.authStatus();
        return { browser, host, authStatus, load: host.activeLeaseCount() };
      }),
    );
    const eligible = candidates.filter((candidate) => candidate.authStatus === "LOGGED_IN");
    if (!eligible.length) {
      throw new Error("No signed-in Gemini browser is available. Open Desktop Settings and sign in to at least one Gemini browser.");
    }

    const minimumLoad = Math.min(...eligible.map((candidate) => candidate.load));
    const leastActive = eligible.filter((candidate) => candidate.load === minimumLoad);
    const cursor = this.roundRobinCursor.get(lane) ?? 0;
    const selected = leastActive[cursor % leastActive.length];
    this.roundRobinCursor.set(lane, cursor + 1);
    return selected.host;
  }
}
