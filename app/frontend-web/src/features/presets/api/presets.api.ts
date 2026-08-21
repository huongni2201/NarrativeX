import { apiRequest } from "@/shared/api/client";
import type { PresetCategory } from "@/types/presets";

export interface ApiStylePreset {
  name: string;
  description: string;
  thumbnail: string | null;
  tags: string[];
}

interface PresetCatalogItem extends ApiStylePreset {
  id: string;
  category: PresetCategory;
  thumbnailUrl: string | null;
}

function isApiStylePreset(value: unknown): value is ApiStylePreset {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiStylePreset>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    (typeof candidate.thumbnail === "string" || candidate.thumbnail === null) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === "string")
  );
}

const ALL_PRESET_CATEGORIES: PresetCategory[] = [
  "VISUAL_STYLE",
  "IMAGE",
  "MOTION",
  "OUTFIT",
  "RENDER",
];

export const presetsApi = {
  list: async (category?: PresetCategory): Promise<PresetCatalogItem[]> => {
    const categories = category ? [category] : ALL_PRESET_CATEGORIES;
    const responses = await Promise.all(
      categories.map((requestedCategory) =>
        apiRequest<ApiStylePreset[]>(
          `/api/v1/style-presets?category=${encodeURIComponent(requestedCategory)}`,
          {},
          (value): value is ApiStylePreset[] =>
            Array.isArray(value) && value.every(isApiStylePreset),
        ),
      ),
    );

    return responses.flatMap((items, categoryIndex) =>
      items.map((preset, itemIndex) => ({
        ...preset,
        id: `${categories[categoryIndex]}:${itemIndex}:${preset.name}`,
        category: categories[categoryIndex],
        thumbnailUrl: preset.thumbnail,
      })),
    );
  },
};
