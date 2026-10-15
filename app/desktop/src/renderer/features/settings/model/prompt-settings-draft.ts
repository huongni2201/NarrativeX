import type { PromptSettings, PromptStyleProfile } from "../../../../shared/api-types";

export const PROMPT_STYLE_ID_PATTERN = /^[A-Za-z0-9_]{1,32}$/;
export const PROMPT_REVISION_CONFLICT_CODE = "PROMPT_SETTINGS_REVISION_CONFLICT";
export const MAX_PROMPT_STYLES = 32;
export const MAX_PROMPT_NAME_LENGTH = 120;
export const MAX_PROMPT_BLOCK_BYTES = 32 * 1024;
export const MAX_PROMPT_TOTAL_BYTES = 512 * 1024;

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export type PromptInstructionKey = keyof PromptSettings["instructions"];

export function clonePromptSettings(settings: PromptSettings): PromptSettings {
  return {
    ...settings,
    styles: settings.styles.map((style) => ({ ...style })),
    instructions: { ...settings.instructions },
  };
}

/** Content equality that ignores the revision, which only identifies what was loaded. */
export function promptSettingsEqual(a: PromptSettings, b: PromptSettings): boolean {
  return (
    a.formatVersion === b.formatVersion &&
    a.activeStyleId === b.activeStyleId &&
    a.videoNegativePrompt === b.videoNegativePrompt &&
    a.instructions.chapterAnalysis === b.instructions.chapterAnalysis &&
    a.instructions.characterReference === b.instructions.characterReference &&
    a.instructions.storyboard === b.instructions.storyboard &&
    a.instructions.video === b.instructions.video &&
    a.styles.length === b.styles.length &&
    a.styles.every((style, index) => {
      const other = b.styles[index];
      return (
        style.id === other.id &&
        style.name === other.name &&
        style.positivePrompt === other.positivePrompt &&
        style.negativePrompt === other.negativePrompt &&
        style.characterRenderingPrompt === other.characterRenderingPrompt
      );
    })
  );
}

export function isPromptDraftDirty(draft: PromptSettings | null, saved: PromptSettings | undefined): boolean {
  return Boolean(draft && saved && !promptSettingsEqual(draft, saved));
}

export function updateStyle(
  settings: PromptSettings,
  styleId: string,
  patch: Partial<Omit<PromptStyleProfile, "id">>,
): PromptSettings {
  return {
    ...settings,
    styles: settings.styles.map((style) => (style.id === styleId ? { ...style, ...patch } : style)),
  };
}

export function updateInstruction(
  settings: PromptSettings,
  key: PromptInstructionKey,
  value: string,
): PromptSettings {
  return { ...settings, instructions: { ...settings.instructions, [key]: value } };
}

export function nextCustomStyleId(settings: PromptSettings): string {
  const taken = new Set(settings.styles.map((style) => style.id));
  for (let n = 1; n <= MAX_PROMPT_STYLES + 1; n += 1) {
    const candidate = `CUSTOM_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `CUSTOM_${taken.size + 1}`;
}

/** Adds a style cloned from `sourceId` (or the first style) and makes it the one being edited. */
export function addStyle(settings: PromptSettings, sourceId: string | null): PromptSettings {
  if (settings.styles.length >= MAX_PROMPT_STYLES) return settings;
  const source = settings.styles.find((style) => style.id === sourceId) ?? settings.styles[0];
  const id = nextCustomStyleId(settings);
  const created: PromptStyleProfile = {
    id,
    name: source ? `${source.name} (copy)` : "Custom style",
    positivePrompt: source?.positivePrompt ?? "",
    negativePrompt: source?.negativePrompt ?? "",
    characterRenderingPrompt: source?.characterRenderingPrompt ?? "",
  };
  return { ...settings, styles: [...settings.styles, created] };
}

/** Removes a style; the last style cannot be removed and the active style falls back to the first. */
export function removeStyle(settings: PromptSettings, styleId: string): PromptSettings {
  if (settings.styles.length <= 1) return settings;
  const styles = settings.styles.filter((style) => style.id !== styleId);
  const activeStyleId =
    settings.activeStyleId === styleId ? styles[0].id : settings.activeStyleId;
  return { ...settings, styles, activeStyleId };
}

/**
 * Replaces the editable content with the packaged defaults but keeps the loaded revision, so the
 * reset is an ordinary draft that still goes through compare-and-set on Save.
 */
export function resetToDefaults(current: PromptSettings, defaults: PromptSettings): PromptSettings {
  return { ...clonePromptSettings(defaults), revision: current.revision };
}

/** Client-side checks that mirror the server's cheap rules; the server stays authoritative. */
export function validatePromptDraft(settings: PromptSettings): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  if (settings.styles.length === 0) problems.push("At least one style is required.");
  for (const style of settings.styles) {
    if (!PROMPT_STYLE_ID_PATTERN.test(style.id)) problems.push(`Style id "${style.id}" is invalid.`);
    if (ids.has(style.id)) problems.push(`Style id "${style.id}" is duplicated.`);
    ids.add(style.id);
    if (!style.name.trim() || style.name.length > MAX_PROMPT_NAME_LENGTH) {
      problems.push(`Style "${style.id}" needs a name of 1-${MAX_PROMPT_NAME_LENGTH} characters.`);
    }
    if (!style.positivePrompt.trim()) problems.push(`Style "${style.id}" needs a positive prompt.`);
  }
  if (!ids.has(settings.activeStyleId)) problems.push("The active style must be one of the styles.");
  if (settings.styles.length > MAX_PROMPT_STYLES) problems.push(`At most ${MAX_PROMPT_STYLES} styles are allowed.`);
  const blocks: Array<[string, string]> = [
    ...settings.styles.flatMap((style): Array<[string, string]> => [
      [`Style "${style.id}" positive prompt`, style.positivePrompt],
      [`Style "${style.id}" negative prompt`, style.negativePrompt],
      [`Style "${style.id}" character rendering`, style.characterRenderingPrompt],
    ]),
    ["Chapter analysis instruction", settings.instructions.chapterAnalysis],
    ["Character reference instruction", settings.instructions.characterReference],
    ["Storyboard instruction", settings.instructions.storyboard],
    ["Video instruction", settings.instructions.video],
    ["Video negative prompt", settings.videoNegativePrompt],
  ];
  let total = 0;
  for (const [label, text] of blocks) {
    const bytes = utf8Bytes(text);
    total += bytes;
    if (bytes > MAX_PROMPT_BLOCK_BYTES) problems.push(`${label} exceeds ${MAX_PROMPT_BLOCK_BYTES} bytes.`);
  }
  if (total > MAX_PROMPT_TOTAL_BYTES) problems.push(`Total prompt text exceeds ${MAX_PROMPT_TOTAL_BYTES} bytes.`);
  return problems;
}

/** Reconciles an in-flight draft with a freshly loaded view without discarding the user's edits. */
export function shouldAdoptLoaded(
  draft: PromptSettings | null,
  saved: PromptSettings | undefined,
  loaded: PromptSettings,
): boolean {
  if (!draft) return true;
  if (!saved) return true;
  return !isPromptDraftDirty(draft, saved) && draft.revision !== loaded.revision;
}
