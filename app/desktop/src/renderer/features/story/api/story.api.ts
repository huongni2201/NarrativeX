import type { DesktopChapterStory, StoryBeatMutationResponse, StoryBeatReviewStatus } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

export const storyApi = {
  getChapterStory: (projectId: string, chapterId: string) =>
    apiRequest<DesktopChapterStory>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/story`,
    ),

  updateStoryBeatReviewStatus: (
    projectId: string,
    chapterId: string,
    storyBeatId: string,
    status: StoryBeatReviewStatus,
    rowVersion: number,
  ) =>
    apiRequest<StoryBeatMutationResponse>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/story-beats/${encodeURIComponent(storyBeatId)}/review-status`,
      {
        method: "PUT",
        headers: {
          "If-Match": `"${rowVersion}"`,
        },
        body: JSON.stringify({ status }),
      },
    ),
};
