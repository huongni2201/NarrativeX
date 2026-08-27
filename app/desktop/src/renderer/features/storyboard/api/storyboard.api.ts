import { apiRequest } from "../../../api/client";

export type VisualBeatReviewStatus = "NEEDS_REVIEW" | "APPROVED";

export interface StoryboardVisualBeat {
  id: string;
  sceneId: string;
  orderIndex: number;
  title: string;
  visualIntent: string;
  prompt: string | null;
  motionMode: string;
  cameraMovement: string;
  cameraAngle: string;
  reviewStatus: VisualBeatReviewStatus;
  aspectRatioOverride: string | null;
  qualityTierOverride: string | null;
  rowVersion: number;
}

export interface StoryboardScene {
  id: string;
  orderIndex: number;
  title: string;
  status: string;
  approvedBeatCount: number;
  totalBeatCount: number;
  visualBeats: StoryboardVisualBeat[];
}

export interface ChapterStoryboard {
  chapter: {
    id: string;
    orderIndex: number;
    title: string;
  };
  scenes: StoryboardScene[];
}

export interface CreateVisualBeatInput {
  title: string;
  visualIntent: string;
}

export const storyboardQueryKey = (projectId: string, chapterId: string) =>
  ["projects", projectId, "chapters", chapterId, "storyboard"] as const;

function chapterPath(projectId: string, chapterId: string) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`;
}

export const storyboardApi = {
  get: (projectId: string, chapterId: string) =>
    apiRequest<ChapterStoryboard>(`${chapterPath(projectId, chapterId)}/storyboard`),

  createVisualBeat: (
    projectId: string,
    chapterId: string,
    sceneId: string,
    input: CreateVisualBeatInput,
  ) =>
    apiRequest<StoryboardVisualBeat>(
      `${chapterPath(projectId, chapterId)}/scenes/${encodeURIComponent(sceneId)}/visual-beats`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),

  updateReviewStatus: (
    projectId: string,
    chapterId: string,
    sceneId: string,
    visualBeatId: string,
    rowVersion: number,
    status: VisualBeatReviewStatus,
  ) =>
    apiRequest<StoryboardVisualBeat>(
      `${chapterPath(projectId, chapterId)}/scenes/${encodeURIComponent(sceneId)}/visual-beats/${encodeURIComponent(visualBeatId)}/review-status`,
      {
        method: "PUT",
        headers: { "If-Match": `"${rowVersion}"` },
        body: JSON.stringify({ status }),
      },
    ),
};
