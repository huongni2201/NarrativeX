import {
  storyboardApi,
  storyboardQueryKey,
  type StoryboardVisualBeat,
} from "../api/storyboard.api.ts";

export const storyboardKeys = {
  chapter: (projectId: string, chapterId: string) => storyboardQueryKey(projectId, chapterId),
};

export async function approveVisualBeats(
  projectId: string,
  chapterId: string,
  beats: readonly Pick<StoryboardVisualBeat, "id" | "sceneId" | "rowVersion">[],
) {
  const results = await Promise.allSettled(
    beats.map((beat) =>
      storyboardApi.updateReviewStatus(
        projectId,
        chapterId,
        beat.sceneId,
        beat.id,
        beat.rowVersion,
        "APPROVED",
      ),
    ),
  );

  return {
    approved: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
