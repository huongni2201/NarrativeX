import type { DesktopPreset } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isRecord, isString } from "../../../api/guards";

const PRESET_CATEGORIES = [
  "VISUAL_STYLE",
  "IMAGE",
  "MOTION",
  "OUTFIT",
  "RENDER",
] as const;

function isPreset(value: unknown): value is DesktopPreset {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isString(value.description) &&
    (value.thumbnail === null || isString(value.thumbnail)) &&
    Array.isArray(value.tags)
  );
}

export const presetsApi = {
  list: () =>
    Promise.all(
      PRESET_CATEGORIES.map((category) =>
        apiRequest<unknown>(
          `/api/v1/style-presets?category=${encodeURIComponent(category)}`,
        ).then((value) => {
          assertContract(
            Array.isArray(value) && value.every(isPreset),
            "Presets response không đúng contract.",
          );
          return value.map((preset) => ({ ...preset, category }));
        }),
      ),
    ).then((groups) => groups.flat()),
};
