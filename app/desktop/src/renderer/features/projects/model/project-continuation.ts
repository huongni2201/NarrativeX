import type { DesktopProject } from "@narrativex/client-contracts";

export interface ProjectContinuationResult {
  destination: string;
  label: string;
  stage?: "source" | "canon" | "story" | "production";
}

/**
 * Determines the recommended workspace destination when a creator clicks "Continue" or opens a project card.
 *
 * Rules:
 * - 0 chapters (or new project) -> chapters workspace (Source stage)
 * - Has chapters -> if status indicates production readiness or timeline editing, go to editor; otherwise chapters
 */
export function resolveProjectContinuation(project: DesktopProject): ProjectContinuationResult {
  const totalChapters = project.metrics?.totalChapters ?? 0;

  if (totalChapters === 0) {
    return {
      destination: `/projects/${project.id}/chapters`,
      label: "Bắt đầu viết kịch bản",
      stage: "source",
    };
  }

  // If project is explicitly READY or COMPLETED, open timeline Editor
  if (project.status === "READY" || project.status === "COMPLETED") {
    return {
      destination: `/projects/${project.id}/editor`,
      label: "Mở Timeline dựng phim",
    };
  }

  // Default for in-progress project with chapters: Chapters workspace
  return {
    destination: `/projects/${project.id}/chapters`,
    label: "Tiếp tục sản xuất",
    stage: "production",
  };
}
