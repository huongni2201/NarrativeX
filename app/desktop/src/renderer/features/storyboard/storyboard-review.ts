import type { VisualBeatReviewStatus } from "./api/storyboard.api";

export type VisualBeatStatusFilter = "ALL" | VisualBeatReviewStatus;

type ReviewableVisualBeat = {
  reviewStatus: VisualBeatReviewStatus;
};

export function filterVisualBeatsByStatus<T extends ReviewableVisualBeat>(
  beats: readonly T[],
  status: VisualBeatStatusFilter,
): T[] {
  return status === "ALL" ? [...beats] : beats.filter((beat) => beat.reviewStatus === status);
}

export function beatsNeedingReview<T extends ReviewableVisualBeat>(beats: readonly T[]): T[] {
  return beats.filter((beat) => beat.reviewStatus === "NEEDS_REVIEW");
}
