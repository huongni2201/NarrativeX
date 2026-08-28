import { storyboardQueryKey } from "../api/storyboard.api";

export const storyboardKeys = {
  chapter: (projectId: string, chapterId: string) => storyboardQueryKey(projectId, chapterId),
};
