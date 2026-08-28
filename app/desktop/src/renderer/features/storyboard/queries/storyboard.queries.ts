import { storyboardQueryKey } from "../api/storyboard.api.ts";

export const storyboardKeys = {
  chapter: (projectId: string, chapterId: string) => storyboardQueryKey(projectId, chapterId),
};
