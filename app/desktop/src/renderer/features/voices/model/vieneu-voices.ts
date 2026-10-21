import type { DesktopVoice } from "../../../../shared/api-types";

export interface VieNeuVoiceMetadata {
  custom: boolean;
  featured: boolean;
  region: string | null;
  description: string | null;
  referenceAssetId: string | null;
  referenceFilename: string | null;
}

const EMPTY_METADATA: VieNeuVoiceMetadata = {
  custom: false,
  featured: false,
  region: null,
  description: null,
  referenceAssetId: null,
  referenceFilename: null,
};

const REGION_LABELS: Record<string, string> = {
  north: "Miền Bắc",
  central: "Miền Trung",
  south: "Miền Nam",
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function parseVoiceMetadata(voice: Pick<DesktopVoice, "metadataJson">): VieNeuVoiceMetadata {
  if (!voice.metadataJson) return EMPTY_METADATA;
  try {
    const parsed: unknown = JSON.parse(voice.metadataJson);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return EMPTY_METADATA;
    const value = parsed as Record<string, unknown>;
    return {
      custom: value.custom === true,
      featured: value.featured === true,
      region: text(value.region),
      description: text(value.description),
      referenceAssetId: text(value.referenceAssetId),
      referenceFilename: text(value.referenceFilename),
    };
  } catch {
    return EMPTY_METADATA;
  }
}

export function regionLabel(region: string | null): string | null {
  return region ? (REGION_LABELS[region] ?? region) : null;
}

export function genderLabel(gender: string | null): string {
  switch (gender) {
    case "MALE":
      return "Nam";
    case "FEMALE":
      return "Nữ";
    case "NEUTRAL":
      return "Trung tính";
    default:
      return "Chưa rõ giới tính";
  }
}

export interface VieNeuVoiceGroups {
  custom: DesktopVoice[];
  builtIn: DesktopVoice[];
}

/** Splits the VieNeu voices into user-created and system voices; featured presets lead. */
export function groupVieNeuVoices(voices: readonly DesktopVoice[]): VieNeuVoiceGroups {
  const byName = (a: DesktopVoice, b: DesktopVoice) => a.name.localeCompare(b.name, "vi");
  const custom: DesktopVoice[] = [];
  const builtIn: DesktopVoice[] = [];
  for (const voice of voices) {
    if (voice.provider !== "VIENEU") continue;
    (parseVoiceMetadata(voice).custom ? custom : builtIn).push(voice);
  }
  builtIn.sort((a, b) => {
    const featured = Number(parseVoiceMetadata(b).featured) - Number(parseVoiceMetadata(a).featured);
    return featured || byName(a, b);
  });
  return { custom: custom.sort(byName), builtIn };
}

export const REFERENCE_MIN_SECONDS_HINT = "3–8 giây, giọng sạch, không nhạc nền";

/** About 50 syllables, which VieNeu reads in roughly 10–15 seconds at normal speed. */
export const VOICE_SAMPLE_TEXT =
  "Xin chào, mình là một giọng đọc tiếng Việt. Hôm nay trời đẹp, mình sẽ cùng bạn kể lại những câu chuyện thật tự nhiên, rõ ràng và dễ nghe. Hy vọng giọng đọc này sẽ phù hợp với câu chuyện của bạn. Hãy thử nghe thật kỹ nhé.";
