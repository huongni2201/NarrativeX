import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type DesktopPreferenceResetScope = "WINDOW" | "ALL";

export interface SavedWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface EffectiveDesktopPreferences {
  window: SavedWindowState | null;
}

type StoredPreferences = {
  schemaVersion: 4;
  window?: SavedWindowState;
};

const EMPTY_PREFERENCES: StoredPreferences = { schemaVersion: 4 };
const LEGACY_ACTIVE_PROFILE_KEY = ["last", "Active", "User", "Id"].join("");
const LEGACY_PROFILES_KEY = "profiles";

function validWindowState(value: unknown): value is SavedWindowState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SavedWindowState>;
  return Number.isFinite(state.x) && Number.isFinite(state.y) &&
    Number.isFinite(state.width) && Number.isFinite(state.height) &&
    Number(state.width) > 0 && Number(state.height) > 0 &&
    typeof state.maximized === "boolean";
}

function cloneWindowState(window: SavedWindowState): SavedWindowState {
  return { ...window };
}

function sanitizePreferences(value: unknown): StoredPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(EMPTY_PREFERENCES);
  }

  const input = value as Record<string, unknown>;
  if (input.schemaVersion === 4) {
    return validWindowState(input.window)
      ? { schemaVersion: 4, window: cloneWindowState(input.window) }
      : structuredClone(EMPTY_PREFERENCES);
  }
  if (input.schemaVersion !== 3) return structuredClone(EMPTY_PREFERENCES);

  const activeProfileId = input[LEGACY_ACTIVE_PROFILE_KEY];
  const profiles = input[LEGACY_PROFILES_KEY];
  const activeProfile =
    typeof activeProfileId === "string" &&
    profiles &&
    typeof profiles === "object" &&
    !Array.isArray(profiles)
      ? (profiles as Record<string, unknown>)[activeProfileId]
      : undefined;
  const legacyWindow =
    activeProfile && typeof activeProfile === "object" && !Array.isArray(activeProfile)
      ? (activeProfile as Record<string, unknown>).window
      : undefined;

  return validWindowState(legacyWindow)
    ? { schemaVersion: 4, window: cloneWindowState(legacyWindow) }
    : structuredClone(EMPTY_PREFERENCES);
}

export class DesktopPreferencesStore {
  private loaded: StoredPreferences | null = null;
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async get(): Promise<EffectiveDesktopPreferences> {
    const state = await this.load();
    return { window: state.window ? cloneWindowState(state.window) : null };
  }

  async updateWindow(window: SavedWindowState): Promise<EffectiveDesktopPreferences> {
    if (!validWindowState(window)) throw new Error("Invalid Desktop window state.");
    return this.commit((state) => {
      state.window = cloneWindowState(window);
      return { window: cloneWindowState(window) };
    });
  }

  async reset(_scope: DesktopPreferenceResetScope): Promise<EffectiveDesktopPreferences> {
    return this.commit((state) => {
      delete state.window;
      return { window: null };
    });
  }

  private async load(): Promise<StoredPreferences> {
    if (this.loaded) return this.loaded;
    try {
      const raw = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      this.loaded = sanitizePreferences(raw);
      if (isLegacyPreferences(raw)) await this.write(this.loaded);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
        throw error;
      }
      this.loaded = structuredClone(EMPTY_PREFERENCES);
    }
    return this.loaded;
  }

  private async commit<T>(mutate: (state: StoredPreferences) => T): Promise<T> {
    let result: T | undefined;
    const operation = this.mutationChain.catch(() => undefined).then(async () => {
      const state = structuredClone(await this.load());
      result = mutate(state);
      await this.write(state);
      this.loaded = state;
    });
    this.mutationChain = operation.catch(() => undefined);
    await operation;
    return result as T;
  }

  private async write(state: StoredPreferences): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}

function isLegacyPreferences(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as { schemaVersion?: unknown }).schemaVersion === 3,
  );
}
