package com.narrativex.backend.feature.storyboard.application.service;

/** Pure policy for deriving Chapter Workspace analysis/planning state from persisted job state. */
public final class ChapterWorkspacePipelinePolicy {
  private ChapterWorkspacePipelinePolicy() {}

  public static PipelineState resolve(
      String chapterSourceHash,
      String analysisStatus,
      String analysisSourceHash,
      boolean hasStoryboard) {
    String effectiveAnalysisStatus = analysisStatus == null ? "NOT_STARTED" : analysisStatus;
    boolean sourceOutdated =
        analysisSourceHash != null && !analysisSourceHash.equals(chapterSourceHash);
    String planningStatus =
        hasStoryboard && !sourceOutdated && "COMPLETED".equals(effectiveAnalysisStatus)
            ? "COMPLETED"
            : "NOT_STARTED";
    return new PipelineState(
        effectiveAnalysisStatus,
        planningStatus,
        sourceOutdated,
        isActive(effectiveAnalysisStatus));
  }

  private static boolean isActive(String status) {
    return switch (status) {
      case "QUEUED", "RUNNING", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT" -> true;
      default -> false;
    };
  }

  public record PipelineState(
      String analysisStatus, String planningStatus, boolean sourceOutdated, boolean analysisActive) {}
}
