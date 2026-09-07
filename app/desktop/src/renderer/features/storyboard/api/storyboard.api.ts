import type {
  PrepareStoryboardGenerationBatchInput,
  StoryboardGenerationBatch,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

export type VisualBeatReviewStatus = "NEEDS_REVIEW" | "APPROVED";

export interface StoryboardVisualDirection {
  shot_size: string;
  camera_angle: string;
  lens_mm: number;
  focus_target: string;
  action_phase: string;
  subject_placement: string;
  foreground: string | null;
  background: string;
  motivated_light: string;
  palette: string;
  camera_movement: string;
  movement_direction: string | null;
  movement_intensity: string;
  crop_safe_area: string;
}

export interface StoryboardVisualBeat {
  id: string;
  sceneId: string;
  orderIndex: number;
  title: string;
  visualIntent: string;
  visualDirectionJson: string | null;
  prompt: string | null;
  motionMode: string;
  reviewStatus: VisualBeatReviewStatus;
  aspectRatioOverride: string | null;
  previewMediaAssetId: string | null;
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

export interface GeminiBeatReference {
  refLabel: string;
  assetId: string;
  characterId: string;
  canonicalName: string;
  beatRole: string | null;
  referenceRole: string | null;
  priority: number;
  contentType: string | null;
  sha256: string | null;
}

export interface GeminiBeatContext {
  visualBeatId: string;
  prompt: string;
  references: GeminiBeatReference[];
}

export interface CreateVisualBeatInput {
  title: string;
  visualIntent: string;
}

export function parseStoryboardVisualDirection(
  value: string | null,
): StoryboardVisualDirection | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardVisualDirection>;
    if (
      typeof parsed.shot_size !== "string" ||
      typeof parsed.camera_angle !== "string" ||
      typeof parsed.camera_movement !== "string"
    ) {
      return null;
    }
    return parsed as StoryboardVisualDirection;
  } catch {
    return null;
  }
}

export const storyboardQueryKey = (projectId: string, chapterId: string) =>
  ["projects", projectId, "chapters", chapterId, "storyboard"] as const;

function chapterPath(projectId: string, chapterId: string) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`;
}

export const storyboardApi = {
  get: (projectId: string, chapterId: string) =>
    apiRequest<ChapterStoryboard>(`${chapterPath(projectId, chapterId)}/storyboard`),

  geminiContext: (projectId: string, chapterId: string, visualBeatId: string) =>
    apiRequest<GeminiBeatContext>(
      `${chapterPath(projectId, chapterId)}/visual-beats/${encodeURIComponent(visualBeatId)}/gemini-context`,
    ),

  prepareGeminiGenerationBatch: (
    projectId: string,
    chapterId: string,
    input: PrepareStoryboardGenerationBatchInput,
    idempotencyKey: string,
  ) =>
    apiRequest<StoryboardGenerationBatch>(
      `${chapterPath(projectId, chapterId)}/gemini-generation-batches:prepare`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    ),

  getGeminiGenerationBatch: (projectId: string, chapterId: string, batchId: string) =>
    apiRequest<StoryboardGenerationBatch>(
      `${chapterPath(projectId, chapterId)}/gemini-generation-batches/${encodeURIComponent(batchId)}`,
    ),

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

  attachPreviewMedia: (
    projectId: string,
    chapterId: string,
    sceneId: string,
    visualBeatId: string,
    rowVersion: number,
    mediaAssetId: string,
  ) =>
    apiRequest<StoryboardVisualBeat>(
      `${chapterPath(projectId, chapterId)}/scenes/${encodeURIComponent(sceneId)}/visual-beats/${encodeURIComponent(visualBeatId)}/preview-media`,
      {
        method: "PUT",
        headers: { "If-Match": `"${rowVersion}"` },
        body: JSON.stringify({ mediaAssetId }),
      },
    ),
};
