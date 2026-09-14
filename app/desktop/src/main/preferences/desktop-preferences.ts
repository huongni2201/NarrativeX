import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type DesktopPreferenceResetScope = "WINDOW" | "ALL";

export interface SavedWindowState {
  x: number; y: number; width: number; height: number; maximized: boolean;
}

export interface EffectiveDesktopPreferences {
  userId: string;
  window: SavedWindowState | null;
}

type StoredProfile = { window?: SavedWindowState };
type StoredPreferences = {
  schemaVersion: 3;
  lastActiveUserId: string | null;
  profiles: Record<string, StoredProfile>;
};

const EMPTY_PREFERENCES: StoredPreferences = {
  schemaVersion: 3, lastActiveUserId: null, profiles: {},
};

function validWindowState(value: unknown): value is SavedWindowState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SavedWindowState>;
  return Number.isFinite(state.x) && Number.isFinite(state.y) &&
    Number.isFinite(state.width) && Number.isFinite(state.height) &&
    Number(state.width) > 0 && Number(state.height) > 0 &&
    typeof state.maximized === "boolean";
}

function sanitizePreferences(value: unknown): StoredPreferences {
  if (!value || typeof value !== "object") return structuredClone(EMPTY_PREFERENCES);
  const input = value as { lastActiveUserId?: unknown; profiles?: unknown };
  const profiles: Record<string, StoredProfile> = {};
  if (input.profiles && typeof input.profiles === "object") {
    for (const [userId, rawProfile] of Object.entries(input.profiles as Record<string, unknown>)) {
      if (!userId.trim() || !rawProfile || typeof rawProfile !== "object") continue;
      const window = (rawProfile as { window?: unknown }).window;
      profiles[userId] = validWindowState(window) ? { window } : {};
    }
  }
  return {
    schemaVersion: 3,
    lastActiveUserId: typeof input.lastActiveUserId === "string" && input.lastActiveUserId.trim()
      ? input.lastActiveUserId : null,
    profiles,
  };
}

export class DesktopPreferencesStore {
  private loaded: StoredPreferences | null = null;
  private activeUserId: string | null = null;
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string, _env: NodeJS.ProcessEnv | Record<string, string | undefined>) {}

  async bindUser(userId: string): Promise<EffectiveDesktopPreferences> {
    const normalized = userId.trim();
    if (!normalized) throw new Error("Desktop preference userId must not be empty.");
    return this.commit((state) => {
      state.lastActiveUserId = normalized;
      state.profiles[normalized] ??= {};
      this.activeUserId = normalized;
      return this.effective(normalized, state.profiles[normalized]);
    });
  }

  async get(): Promise<EffectiveDesktopPreferences> {
    const state = await this.load();
    const userId = this.activeUserId ?? state.lastActiveUserId;
    if (!userId) throw new Error("Desktop preferences are not bound to a user.");
    this.activeUserId = userId;
    return this.effective(userId, state.profiles[userId] ?? {});
  }

  async getLastActive(): Promise<EffectiveDesktopPreferences | null> {
    const state = await this.load();
    if (!state.lastActiveUserId) return null;
    this.activeUserId = state.lastActiveUserId;
    return this.effective(state.lastActiveUserId, state.profiles[state.lastActiveUserId] ?? {});
  }

  async updateWindow(window: SavedWindowState): Promise<EffectiveDesktopPreferences> {
    if (!validWindowState(window)) throw new Error("Invalid Desktop window state.");
    return this.mutateActive((profile) => { profile.window = { ...window }; });
  }

  async reset(_scope: DesktopPreferenceResetScope): Promise<EffectiveDesktopPreferences> {
    return this.mutateActive((profile) => { delete profile.window; });
  }

  private async mutateActive(mutate: (profile: StoredProfile) => void) {
    return this.commit((state) => {
      const userId = this.activeUserId ?? state.lastActiveUserId;
      if (!userId) throw new Error("Desktop preferences are not bound to a user.");
      const profile = state.profiles[userId] ?? {};
      mutate(profile);
      state.profiles[userId] = profile;
      return this.effective(userId, profile);
    });
  }

  private effective(userId: string, profile: StoredProfile): EffectiveDesktopPreferences {
    return { userId, window: profile.window ? { ...profile.window } : null };
  }

  private async load(): Promise<StoredPreferences> {
    if (this.loaded) return this.loaded;
    try { this.loaded = sanitizePreferences(JSON.parse(await readFile(this.filePath, "utf8"))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      this.loaded = structuredClone(EMPTY_PREFERENCES);
    }
    return this.loaded;
  }

  private async commit<T>(mutate: (state: StoredPreferences) => T): Promise<T> {
    let result: T | undefined;
    const operation = this.mutationChain.catch(() => undefined).then(async () => {
      const state = structuredClone(await this.load());
      result = mutate(state);
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
      this.loaded = state;
    });
    this.mutationChain = operation.catch(() => undefined);
    await operation;
    return result as T;
  }
}
