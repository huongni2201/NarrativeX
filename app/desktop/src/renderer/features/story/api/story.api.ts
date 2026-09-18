import type { DesktopChapterStory } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

export const storyApi = {
  getChapterStory: (projectId: string, chapterId: string) =>
    apiRequest<DesktopChapterStory>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/story`,
    ),
};
