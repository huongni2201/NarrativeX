import type { DesktopProject } from "@narrativex/client-contracts";

export interface ProjectContinuationResult {
  destination: string;
  label: string;
  stage?: "source" | "canon" | "story" | "production";
}

/**
 * Determines the recommended workspace destination when a creator clicks "Continue" or opens a project card.
 *
 * Backend workflow state is authoritative. Missing workflow state falls back to Source.
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

  return {
    destination: `/projects/${project.id}/chapters?stage=source`,
    label: totalChapters > 0 ? "Tiếp tục tại Source" : "Bắt đầu viết kịch bản",
    stage: "source",
  };
}

export function mergeBackendProject(
  localProject: DesktopProject,
  backendProject: DesktopProject,
): DesktopProject {
  return {
    ...localProject,
    ...backendProject,
    isStarred: backendProject.isStarred ?? localProject.isStarred,
    metrics: backendProject.metrics ?? localProject.metrics,
    workflow: backendProject.workflow ?? localProject.workflow ?? null,
  };
}

export function withoutBackendWorkflow(project: DesktopProject): DesktopProject {
  return { ...project, workflow: null };
}
