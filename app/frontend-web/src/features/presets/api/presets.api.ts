import { apiRequest } from "@/shared/api/client";
import type { PresetCategory } from "@/types/presets";

export interface ApiStylePreset {
  id: number;
  name: string;
  category: PresetCategory;
  description: string;
  thumbnailUrl: string | null;
  promptSuffix: string | null;
  negativePrompt: string | null;
  tags: string[];
  configJson: string;
  createdAt: string;
}

function isApiStylePreset(value: unknown): value is ApiStylePreset {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiStylePreset>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.description === "string" &&
    Array.isArray(candidate.tags)
  );
}

export const presetsApi = {
  list: (category?: PresetCategory) =>
    apiRequest<ApiStylePreset[]>(
      `/api/v1/style-presets${category ? `?category=${encodeURIComponent(category)}` : ""}`,
      {},
      (value): value is ApiStylePreset[] => Array.isArray(value) && value.every(isApiStylePreset),
    ),
};
