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

function isApiVoice(value: unknown): value is ApiVoice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiVoice>;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.language === "string";
}

export const voicesApi = {
  list: (language?: string) =>
    apiRequest<ApiVoice[]>(
      `/api/v1/voices${language ? `?language=${encodeURIComponent(language)}` : ""}`,
      {},
      (value): value is ApiVoice[] => Array.isArray(value) && value.every(isApiVoice),
    ),
};
