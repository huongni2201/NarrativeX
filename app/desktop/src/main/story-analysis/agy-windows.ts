import type { Violation } from "./types.ts";

/**
 * A long chapter is analyzed window by window: one `agy` call has an output ceiling, and a beat costs roughly ten times
 * its source text in output. Chapters that fit one window run exactly like before.
 */
export const WINDOW_MAX_CHARS = 6_000;
/** How far back from the size limit a window may move its end to land on the end of a sentence. */
const SENTENCE_LOOKBACK_UNITS = 12;
const SENTENCE_END = /[.!?…]["'”’»)\]]*$/u;
const MAX_REPAIR_LINES = 40;

export interface Window { first: number; last: number; index: number; count: number }
interface SourceUnit { index: number; text: string }

/** Splits the unit list into consecutive windows of at most `maxChars` characters, preferring sentence ends. */
export function planWindows(units: SourceUnit[], maxChars = WINDOW_MAX_CHARS): Window[] {
  const bounds: Array<{ first: number; last: number }> = [];
  let first = 0;
  while (first < units.length) {
    let last = first;
    let size = units[first]!.text.length;
    while (last + 1 < units.length && size + units[last + 1]!.text.length <= maxChars) { last++; size += units[last]!.text.length; }
    if (last + 1 < units.length) {
      // Moving the end back by a few units keeps a sentence (and usually a dialogue exchange) inside one window.
      for (let back = last; back > Math.max(first, last - SENTENCE_LOOKBACK_UNITS); back--) {
        if (SENTENCE_END.test(units[back]!.text.trim())) { last = back; break; }
      }
    }
    bounds.push({ first: units[first]!.index, last: units[last]!.index });
    first = last + 1;
  }
  return bounds.map((bound, index) => ({ ...bound, index, count: bounds.length }));
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value: unknown): Json[] => Array.isArray(value) ? value.filter(isObject) : [];
const key = (entity: Json): string => String(entity.ai_name ?? "").trim().toLowerCase();

/** What the next window needs to reuse the same names: identity only, never visual prompts. */
export function knownCanon(canon: { characters: Json[]; locations: Json[] }): Json {
  return {
    characters: canon.characters.map(({ ai_name, canonical_name, aliases, role }) => ({ ai_name, canonical_name, aliases, role })),
    locations: canon.locations.map(({ ai_name, name, aliases }) => ({ ai_name, name, aliases })),
  };
}

/** Compact identity context for STORY windows; visual prompts stay outside each request. */
export function storyCanonContext(canon: { characters: Json[]; locations: Json[] }): MergedCanon {
  return {
    characters: canon.characters.map(({ ai_name, canonical_name, aliases, role, importance, description }) => ({ ai_name, canonical_name, aliases, role, importance, description })),
    locations: canon.locations.map(({ ai_name, name, aliases, description }) => ({ ai_name, name, aliases, description })),
  };
}

/** Full definitions supplied only to later CANON windows so repeated identities stay stable. */
export function knownCanonDefinitions(canon: { characters: Json[]; locations: Json[] }): MergedCanon {
  return {
    characters: canon.characters.map(({ ai_name, canonical_name, aliases, role, importance, description, visual_prompt }) => ({ ai_name, canonical_name, aliases, role, importance, description, visual_prompt })),
    locations: canon.locations.map(({ ai_name, name, aliases, description, visual_prompt }) => ({ ai_name, name, aliases, description, visual_prompt })),
  };
}

export interface MergedCanon { characters: Json[]; locations: Json[] }

export class CanonMergeError extends Error {
  constructor() {
    super("CANON_CONFLICT");
  }
}

/** Legacy merge behavior retained for jobs frozen on the combined 1.2 contract. */
export function mergeCanon(into: MergedCanon, canon: unknown): MergedCanon {
  const source = isObject(canon) ? canon : {};
  const merge = (target: Json[], incoming: Json[]): Json[] => {
    const result = [...target];
    for (const entity of incoming) {
      const id = key(entity);
      if (!id) continue;
      const existing = result.find(candidate => key(candidate) === id);
      if (!existing) { result.push(entity); continue; }
      const aliases = new Set<string>([...(Array.isArray(existing.aliases) ? existing.aliases : []), ...(Array.isArray(entity.aliases) ? entity.aliases : [])].filter((alias): alias is string => typeof alias === "string"));
      if (aliases.size) existing.aliases = [...aliases];
    }
    return result;
  };
  return { characters: merge(into.characters, list(source.characters)), locations: merge(into.locations, list(source.locations)) };
}

/** Staged CANON merging rejects duplicate ids and changed definitions instead of overwriting them. */
export function mergeStagedCanon(into: MergedCanon, canon: unknown): MergedCanon {
  if (!isObject(canon) || !Array.isArray(canon.characters) || !Array.isArray(canon.locations)) {
    throw new CanonMergeError();
  }
  const source = canon;
  const merge = (target: Json[], incoming: Json[], definitionFields: string[]): Json[] => {
    const result = [...target];
    const seen = new Set<string>();
    for (const entity of incoming) {
      const id = key(entity);
      if (!id || seen.has(id)) throw new CanonMergeError();
      seen.add(id);
      const existing = result.find(candidate => key(candidate) === id);
      if (!existing) { result.push(entity); continue; }
      if (definitionFields.some(field => JSON.stringify(existing[field] ?? null) !== JSON.stringify(entity[field] ?? null))) {
        throw new CanonMergeError();
      }
      const aliases = new Set<string>([...(Array.isArray(existing.aliases) ? existing.aliases : []), ...(Array.isArray(entity.aliases) ? entity.aliases : [])].filter((alias): alias is string => typeof alias === "string"));
      if (aliases.size) existing.aliases = [...aliases];
    }
    return result;
  };
  return {
    characters: merge(into.characters, list(source.characters), ["canonical_name", "role", "importance", "description", "visual_prompt"]),
    locations: merge(into.locations, list(source.locations), ["name", "description", "visual_prompt"]),
  };
}

export function parseObject(rawJson: string): Json | null {
  try { const value = JSON.parse(rawJson); return isObject(value) ? value : null; } catch { return null; }
}

/** The result of one window as the backend should check it: the canon so far plus this window's scenes. */
export function windowCandidate(canon: MergedCanon, window: Json): string {
  return JSON.stringify({ canon, scenes: Array.isArray(window.scenes) ? window.scenes : [] });
}

/** The scene a window ended on, so the next window can continue it instead of restarting the story. */
export function lastScene(scenes: unknown): Json | null {
  const last = Array.isArray(scenes) ? scenes[scenes.length - 1] : null;
  return isObject(last) ? { title: last.title, location_ai_name: last.location_ai_name, character_ai_names: last.character_ai_names } : null;
}

/** Windows of one chapter become one result: every scene in order, the canon merged. */
export function combineWindows(canon: MergedCanon, scenes: unknown[]): string {
  return JSON.stringify({ canon, scenes });
}

/** The follow-up turn for a result the backend cannot accept. Only errors are listed: warnings never justify a call. */
export function repairMessage(violations: Violation[], window: Window | null): string {
  const errors = violations.filter(violation => violation.severity === "ERROR").slice(0, MAX_REPAIR_LINES);
  const scope = window ? `for units ${window.first}..${window.last}` : "for the whole chapter";
  return [
    `Your previous answer cannot be used yet. Fix every problem below and return the complete corrected JSON object ${scope} in the same format. Deliver it only through the structured-output tool (finish); do not run commands or read files.`,
    "",
    ...errors.map(violation => `- ${violation.path}: ${violation.message}`),
  ].join("\n");
}

export const errorsOf = (violations: Violation[] | null): number => violations?.filter(violation => violation.severity === "ERROR").length ?? 0;
