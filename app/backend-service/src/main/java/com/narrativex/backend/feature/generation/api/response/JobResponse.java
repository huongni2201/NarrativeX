package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.value.AnalysisProgress;
import java.math.BigDecimal;
import java.util.UUID;

public record JobResponse(
    UUID jobId,
    String type,
    String status,
    int progress,
    String currentStep,
    String entityType,
    UUID entityId,
    JobTarget target,
    String errorCode,
    UUID mediaPlanId,
    Integer mediaPlanRevision,
    Estimate estimate,
    String phase,
    Integer completedShards,
    Integer totalShards,
    Integer reusedShards,
    Integer repairCount,
    UUID continuityReportId,
    String pipelineVersion) {
  public JobResponse(
      UUID jobId,
      String type,
      String status,
      int progress,
      String currentStep,
      String entityType,
      UUID entityId,
      JobTarget target,
      String errorCode) {
    this(
        jobId,
        type,
        status,
        progress,
        currentStep,
        entityType,
        entityId,
        target,
        errorCode,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }

  public static JobResponse from(GenerationJob job) {
    return from(job, null, null);
  }

  public static JobResponse from(GenerationJob job, Estimate estimate) {
    return from(job, estimate, null);
  }

  public static JobResponse fromWithAnalysisProgress(
      GenerationJob job, AnalysisProgress analysisProgress) {
    return from(job, null, analysisProgress);
  }

  public static JobResponse from(
      GenerationJob job, Estimate estimate, AnalysisProgress analysisProgress) {
    JobTarget target = targetFor(job);
    return new JobResponse(
        job.getJobId(),
        job.getType().name(),
        job.getStatus().name(),
        job.getProgress(),
        job.getCurrentStep(),
        target.type(),
        target.id(),
        target,
        job.getErrorCode(),
        job.getMediaPlanId(),
        job.getMediaPlanRevision(),
        estimate,
        analysisProgress == null ? null : analysisProgress.phase(),
        analysisProgress == null ? null : analysisProgress.completedShards(),
        analysisProgress == null ? null : analysisProgress.totalShards(),
        analysisProgress == null ? null : analysisProgress.reusedShards(),
        analysisProgress == null ? null : analysisProgress.repairCount(),
        analysisProgress == null ? null : analysisProgress.continuityReportId(),
        analysisProgress == null ? null : analysisProgress.pipelineVersion());
  }

  private static JobTarget targetFor(GenerationJob job) {
    if (job.getChapterId() != null) return new JobTarget("CHAPTER", job.getChapterId());
    if (job.getStoryVersionId() != null)
      return new JobTarget("STORY_VERSION", job.getStoryVersionId());
    return new JobTarget("PROJECT", job.getProjectId());
  }

  public record JobTarget(String type, UUID id) {}

  public record Estimate(
      String currency,
      BigDecimal minimum,
      BigDecimal expected,
      BigDecimal maximum,
      BigDecimal maxAuthorized) {}
}
