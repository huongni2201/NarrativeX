import type { QueryClient } from "@tanstack/react-query";
import type { ProjectSubtitleSettings } from "@narrativex/client-contracts";

export async function cacheSavedSubtitleSettings(client: QueryClient, projectId: string, settings: ProjectSubtitleSettings) {
  await client.cancelQueries({ queryKey: ["project-subtitle-settings", projectId], exact: true });
  client.setQueryData(["project-subtitle-settings", projectId], settings);
}
