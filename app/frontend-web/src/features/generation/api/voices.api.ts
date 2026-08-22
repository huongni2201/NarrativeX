import { apiRequest } from "@/shared/api/client";

export interface ApiVoice {
  id: string;
  provider: string;
  name: string;
  language: string;
  gender: "FEMALE" | "MALE" | string | null;
  sampleUrl: string | null;
  metadataJson: string;
}

export interface VoiceCapabilitiesMetadata {
  supportsSpeakingRate?: boolean;
  supportsVoiceClone?: boolean;
  supportsBatch?: boolean;
  sampleRateHz?: number;
  executionSemantics?: string;
}

function isApiVoice(value: unknown): value is ApiVoice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiVoice>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.language === "string"
  );
}

export function parseVoiceCapabilities(
  metadataJson: string,
  provider: string,
): VoiceCapabilitiesMetadata {
  try {
    const parsed = JSON.parse(metadataJson) as VoiceCapabilitiesMetadata;
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid metadata");
    return parsed;
  } catch {
    const isVieNeu = provider.toUpperCase() === "VIENEU";
    return {
      supportsSpeakingRate: !isVieNeu,
      supportsVoiceClone: isVieNeu,
      supportsBatch: isVieNeu,
      sampleRateHz: 48_000,
      executionSemantics: isVieNeu ? "LOCAL_RETRYABLE" : "EXTERNAL_DURABLE",
    };
  }
}

export const voicesApi = {
  list: (language?: string) =>
    apiRequest<ApiVoice[]>(
      `/api/v1/voices${language ? `?language=${encodeURIComponent(language)}` : ""}`,
      {},
      (value): value is ApiVoice[] => Array.isArray(value) && value.every(isApiVoice),
    ),
};
