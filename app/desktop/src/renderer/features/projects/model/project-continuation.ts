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
  const workflow = project.workflow;
  const totalChapters = project.metrics?.totalChapters ?? 0;

  if (workflow) {
    if (workflow.renderInProgress) {
      return {
        destination: `/projects/${project.id}/editor`,
        label: "Xem tiến độ Render",
      };
    }
    if (workflow.editorReady) {
      return {
        destination: `/projects/${project.id}/editor`,
        label: "Mở Timeline dựng phim",
      };
    }
    if (workflow.productionStarted || workflow.storyReady) {
      return {
        destination: `/projects/${project.id}/chapters?stage=production`,
        label: "Tiếp tục sản xuất",
        stage: "production",
      };
    }
    if (workflow.canonReady) {
      return {
        destination: `/projects/${project.id}/chapters?stage=story`,
        label: "Tiếp tục Storyboard",
        stage: "story",
      };
    }
    if (workflow.analysisReady) {
      return {
        destination: `/projects/${project.id}/chapters?stage=canon`,
        label: "Tiếp tục Canon",
        stage: "canon",
      };
    }
    return {
      destination: `/projects/${project.id}/chapters?stage=source`,
      label: "Bắt đầu viết kịch bản",
      stage: "source",
    };
  }

  // Fallback when workflow is not provided
  if (totalChapters === 0) {
    return {
      destination: `/projects/${project.id}/chapters?stage=source`,
      label: "Bắt đầu viết kịch bản",
      stage: "source",
    };
  }

  // If scenes exist, production is ready or started
  const totalScenes = project.metrics?.totalScenes ?? 0;
  if (totalScenes > 0) {
    return {
      destination: `/projects/${project.id}/chapters?stage=production`,
      label: "Tiếp tục sản xuất",
      stage: "production",
    };
  }

  return {
    destination: `/projects/${project.id}/chapters?stage=source`,
    label: "Tiếp tục viết kịch bản",
    stage: "source",
  };
}
