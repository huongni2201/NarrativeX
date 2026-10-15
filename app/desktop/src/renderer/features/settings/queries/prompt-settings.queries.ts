import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PromptSettings } from "../../../../shared/api-types";
import { promptSettingsApi } from "../api/prompt-settings.api.ts";

export const promptSettingsKeys = {
  all: ["settings", "prompts"] as const,
  saved: () => [...promptSettingsKeys.all, "saved"] as const,
};

export function usePromptSettings() {
  return useQuery({
    queryKey: promptSettingsKeys.saved(),
    queryFn: () => promptSettingsApi.get(),
    // The draft lives in component state; never refetch behind the user's back.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSavePromptSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: PromptSettings) => promptSettingsApi.save(settings),
    onSuccess: (view) => {
      queryClient.setQueryData(promptSettingsKeys.saved(), view);
    },
  });
}
