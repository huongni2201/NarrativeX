import type {
  PromptSettings,
  PromptSettingsView,
} from "../../../../shared/api-types";
import { apiRequest } from "../../../api/client.ts";

export const promptSettingsApi = {
  get: () => apiRequest<PromptSettingsView>("/api/v1/settings/prompts"),

  /** The body's `revision` is the revision being edited (compare-and-set on the server). */
  save: (settings: PromptSettings) =>
    apiRequest<PromptSettingsView>("/api/v1/settings/prompts", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};
