import type { DesktopPreset } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isRecord, isString } from "../../../api/guards";

function isPreset(value: unknown): value is DesktopPreset {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isString(value.category) &&
    isString(value.description) &&
    (value.thumbnail === null || isString(value.thumbnail)) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString)
  );
}

export const presetsApi = {
  list: () =>
    apiRequest<unknown>("/api/v1/style-presets").then((value) => {
      assertContract(
        Array.isArray(value) && value.every(isPreset),
        "Presets response không đúng contract.",
      );
      return value;
    }),
};
