import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  addGeminiBrowserProfile,
  removeGeminiBrowserProfile,
  sanitizeGeminiBrowserProfiles,
  setGeminiBrowserLoginConfirmed,
  type GeminiBrowserProfile,
} from "../gemini-web/gemini-browser-registry.ts";

export const MIN_GEMINI_TAB_COUNT = 1;
export const MAX_GEMINI_TAB_COUNT = 8;
export const BUILTIN_GEMINI_DEFAULTS = {
  characterTabs: 2,
  storyboardTabs: 4,
} as const;

export type DesktopPreferenceResetScope = "GEMINI" | "WINDOW" | "ALL";

export interface SavedWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface GeminiTabCounts {
  characterTabs: number;
  storyboardTabs: number;
}

export interface EffectiveDesktopPreferences {
  userId: string;
  gemini: GeminiTabCounts & {
    browsers: GeminiBrowserProfile[];
    environmentDefaults: GeminiTabCounts;
  };
  window: SavedWindowState | null;
}

type StoredGeminiPreferences = Partial<GeminiTabCounts> & {
  browsers?: GeminiBrowserProfile[];
};

type StoredProfile = {
  gemini?: StoredGeminiPreferences;
  window?: SavedWindowState;
};

type StoredPreferences = {
  schemaVersion: 2;
  lastActiveUserId: string | null;
  profiles: Record<string, StoredProfile>;
};

const EMPTY_PREFERENCES: StoredPreferences = {
  schemaVersion: 2,
  lastActiveUserId: null,
  profiles: {},
};

function validTabCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= MIN_GEMINI_TAB_COUNT && Number(value) <= MAX_GEMINI_TAB_COUNT;
}

function parseTabCount(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return validTabCount(parsed) ? parsed : fallback;
}

export function resolveGeminiDefaults(env: NodeJS.ProcessEnv | Record<string, string | undefined>): GeminiTabCounts {
  return {
    characterTabs: parseTabCount(
      env.NARRATIVEX_GEMINI_CHARACTER_TAB_COUNT,
      BUILTIN_GEMINI_DEFAULTS.characterTabs,
    ),
    storyboardTabs: parseTabCount(
      env.NARRATIVEX_GEMINI_STORYBOARD_TAB_COUNT,
      BUILTIN_GEMINI_DEFAULTS.storyboardTabs,
    ),
  };
}

function validWindowState(value: unknown): value is SavedWindowState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SavedWindowState>;
  return (
    Number.isFinite(state.x) &&
    Number.isFinite(state.y) &&
    Number.isFinite(state.width) &&
    Number.isFinite(state.height) &&
    Number(state.width) > 0 &&
    Number(state.height) > 0 &&
    typeof state.maximized === "boolean"
  );
}

function sanitizeProfile(value: unknown): StoredProfile {
  if (!value || typeof value !== "object") {
    return { gemini: { browsers: sanitizeGeminiBrowserProfiles(undefined) } };
  }
  const profile = value as { gemini?: unknown; window?: unknown };
  const sanitized: StoredProfile = {};
  const next: StoredGeminiPreferences = {
    browsers: sanitizeGeminiBrowserProfiles(
      profile.gemini && typeof profile.gemini === "object"
        ? (profile.gemini as { browsers?: unknown }).browsers
        : undefined,
    ),
  };
  if (profile.gemini && typeof profile.gemini === "object") {
    const gemini = profile.gemini as Partial<GeminiTabCounts>;
    if (validTabCount(gemini.characterTabs)) next.characterTabs = gemini.characterTabs;
    if (validTabCount(gemini.storyboardTabs)) next.storyboardTabs = gemini.storyboardTabs;
  }
  sanitized.gemini = next;
  if (validWindowState(profile.window)) sanitized.window = profile.window;
  return sanitized;
}

function sanitizePreferences(value: unknown): StoredPreferences {
  if (!value || typeof value !== "object") return { ...EMPTY_PREFERENCES, profiles: {} };
  const input = value as {
    schemaVersion?: unknown;
    lastActiveUserId?: unknown;
    profiles?: unknown;
  };
  if (
    input.schemaVersion !== 2 ||
    !input.profiles ||
    typeof input.profiles !== "object"
  ) {
    return { ...EMPTY_PREFERENCES, profiles: {} };
  }
  const profiles: Record<string, StoredProfile> = {};
  for (const [userId, profile] of Object.entries(input.profiles as Record<string, unknown>)) {
    if (!userId.trim()) continue;
    profiles[userId] = sanitizeProfile(profile);
  }
  return {
    schemaVersion: 2,
    lastActiveUserId:
      typeof input.lastActiveUserId === "string" && input.lastActiveUserId.trim()
        ? input.lastActiveUserId
        : null,
    profiles,
  };
}

export class DesktopPreferencesStore {
  private readonly environmentDefaults: GeminiTabCounts;
  private loaded: StoredPreferences | null = null;
  private loadPromise: Promise<StoredPreferences> | null = null;
  private activeUserId: string | null = null;
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  ) {
    this.environmentDefaults = resolveGeminiDefaults(env);
  }

  async bindUser(userId: string): Promise<EffectiveDesktopPreferences> {
    const normalized = userId.trim();
    if (!normalized) throw new Error("Desktop preference userId must not be empty.");
    return this.commitMutation((state) => {
      state.lastActiveUserId = normalized;
      state.profiles[normalized] ??= sanitizeProfile(undefined);
      return {
        value: this.effective(normalized, state.profiles[normalized]),
        activeUserId: normalized,
      };
    });
  }

  async get(): Promise<EffectiveDesktopPreferences> {
    const state = await this.load();
    const userId = this.activeUserId ?? state.lastActiveUserId;
    if (!userId) throw new Error("Desktop preferences are not bound to a user.");
    this.activeUserId = userId;
    const profile = state.profiles[userId] ?? sanitizeProfile(undefined);
    return this.effective(userId, profile);
  }

  async getLastActive(): Promise<EffectiveDesktopPreferences | null> {
    const state = await this.load();
    if (!state.lastActiveUserId) return null;
    this.activeUserId = state.lastActiveUserId;
    const profile = state.profiles[state.lastActiveUserId] ?? sanitizeProfile(undefined);
    return this.effective(state.lastActiveUserId, profile);
  }

  async updateGemini(update: Partial<GeminiTabCounts>): Promise<EffectiveDesktopPreferences> {
    return this.mutateActive((state, userId, profile) => {
      const next: StoredGeminiPreferences = {
        ...(profile.gemini ?? {}),
        browsers: this.browserProfiles(profile),
      };
      if (update.characterTabs !== undefined) {
        if (!validTabCount(update.characterTabs)) throw new Error("Character Gemini tab count must be between 1 and 8.");
        next.characterTabs = update.characterTabs;
      }
      if (update.storyboardTabs !== undefined) {
        if (!validTabCount(update.storyboardTabs)) throw new Error("Storyboard Gemini tab count must be between 1 and 8.");
        next.storyboardTabs = update.storyboardTabs;
      }
      profile.gemini = next;
      state.profiles[userId] = profile;
    });
  }

  async addGeminiBrowser(): Promise<EffectiveDesktopPreferences> {
    return this.mutateActive((state, userId, profile) => {
      profile.gemini = {
        ...(profile.gemini ?? {}),
        browsers: addGeminiBrowserProfile(this.browserProfiles(profile)),
      };
      state.profiles[userId] = profile;
    });
  }

  async setGeminiBrowserLoginConfirmed(
    browserId: string,
    loginConfirmed: boolean,
  ): Promise<EffectiveDesktopPreferences> {
    return this.mutateActive((state, userId, profile) => {
      profile.gemini = {
        ...(profile.gemini ?? {}),
        browsers: setGeminiBrowserLoginConfirmed(
          this.browserProfiles(profile),
          browserId,
          loginConfirmed,
        ),
      };
      state.profiles[userId] = profile;
    });
  }

  async removeGeminiBrowser(browserId: string): Promise<EffectiveDesktopPreferences> {
    return this.mutateActive((state, userId, profile) => {
      profile.gemini = {
        ...(profile.gemini ?? {}),
        browsers: removeGeminiBrowserProfile(this.browserProfiles(profile), browserId),
      };
      state.profiles[userId] = profile;
    });
  }

  async updateWindow(window: SavedWindowState): Promise<EffectiveDesktopPreferences> {
    if (!validWindowState(window)) throw new Error("Invalid Desktop window state.");
    return this.mutateActive((state, userId, profile) => {
      profile.window = { ...window };
      state.profiles[userId] = profile;
    });
  }

  async reset(scope: DesktopPreferenceResetScope): Promise<EffectiveDesktopPreferences> {
    return this.mutateActive((state, userId, profile) => {
      if (scope === "ALL") {
        state.profiles[userId] = {
          gemini: { browsers: this.browserProfiles(profile) },
        };
      } else if (scope === "GEMINI") {
        profile.gemini = { browsers: this.browserProfiles(profile) };
        state.profiles[userId] = profile;
      } else if (scope === "WINDOW") {
        delete profile.window;
        state.profiles[userId] = profile;
      } else {
        throw new Error("Unsupported Desktop preference reset scope.");
      }
    });
  }

  private async mutateActive(
    mutate: (state: StoredPreferences, userId: string, profile: StoredProfile) => void,
  ): Promise<EffectiveDesktopPreferences> {
    return this.commitMutation((state) => {
      const userId = this.activeUserId ?? state.lastActiveUserId;
      if (!userId) throw new Error("Desktop preferences are not bound to a user.");
      const profile = state.profiles[userId] ?? sanitizeProfile(undefined);
      state.profiles[userId] = profile;
      mutate(state, userId, profile);
      return {
        value: this.effective(userId, state.profiles[userId]),
        activeUserId: userId,
      };
    });
  }

  private browserProfiles(profile: StoredProfile): GeminiBrowserProfile[] {
    return sanitizeGeminiBrowserProfiles(profile.gemini?.browsers);
  }

  private effective(userId: string, profile: StoredProfile): EffectiveDesktopPreferences {
    return {
      userId,
      gemini: {
        characterTabs: profile.gemini?.characterTabs ?? this.environmentDefaults.characterTabs,
        storyboardTabs: profile.gemini?.storyboardTabs ?? this.environmentDefaults.storyboardTabs,
        browsers: this.browserProfiles(profile),
        environmentDefaults: { ...this.environmentDefaults },
      },
      window: profile.window ? { ...profile.window } : null,
    };
  }

  private async load(): Promise<StoredPreferences> {
    if (this.loaded) return this.loaded;
    this.loadPromise ??= this.readPreferences();
    try {
      this.loaded = await this.loadPromise;
      return this.loaded;
    } finally {
      this.loadPromise = null;
    }
  }

  private async readPreferences(): Promise<StoredPreferences> {
    try {
      return sanitizePreferences(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
        throw error;
      }
      return { ...EMPTY_PREFERENCES, profiles: {} };
    }
  }

  private async commitMutation<T>(
    mutate: (state: StoredPreferences) => { value: T; activeUserId?: string },
  ): Promise<T> {
    let result: T | undefined;
    const operation = this.mutationChain
      .catch(() => undefined)
      .then(async () => {
        const state = structuredClone(await this.load());
        const mutation = mutate(state);
        await this.persist(state);
        this.loaded = state;
        if (mutation.activeUserId !== undefined) this.activeUserId = mutation.activeUserId;
        result = mutation.value;
      });
    this.mutationChain = operation.catch(() => undefined);
    await operation;
    return result as T;
  }

  private async persist(state: StoredPreferences): Promise<void> {
    const payload = `${JSON.stringify(state, null, 2)}\n`;
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, payload, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
