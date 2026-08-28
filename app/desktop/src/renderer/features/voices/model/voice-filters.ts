import type { DesktopVoice } from "@narrativex/client-contracts";

export type VoiceSortMode = "name-asc" | "name-desc";

export interface VoiceFilters {
  query: string;
  language: string;
  gender: string;
  provider: string;
  tag: string;
  sortMode: VoiceSortMode;
}

export function filterVoices(voices: DesktopVoice[], filters: VoiceFilters): DesktopVoice[] {
  const needle = filters.query.trim().toLocaleLowerCase();

  return voices
    .filter((voice) => {
      const searchable = `${voice.name} ${voice.language} ${voice.provider} ${voice.gender ?? ""}`
        .toLocaleLowerCase();

      return (
        (!needle || searchable.includes(needle)) &&
        (filters.language === "all" || voice.language === filters.language) &&
        (filters.gender === "all" || voice.gender === filters.gender) &&
        (filters.provider === "all" || voice.provider === filters.provider) &&
        (filters.tag === "all" ||
          [voice.language, voice.gender, voice.provider].includes(filters.tag))
      );
    })
    .sort((left, right) => {
      const direction = filters.sortMode === "name-asc" ? 1 : -1;
      return left.name.localeCompare(right.name, "vi") * direction;
    });
}

export function uniqueVoiceValues(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, "vi"));
}

export function playableSampleUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
