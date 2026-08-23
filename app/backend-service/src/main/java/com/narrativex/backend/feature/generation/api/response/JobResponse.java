package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.math.BigDecimal;
import java.util.UUID;

public record JobResponse(
    String jobId,
    String type,
    String status,
    int progress,
    String currentStep,
    String entityType,
    Long entityId,
    JobTarget target,
    String errorCode,
    UUID mediaPlanId,
    Integer mediaPlanRevision,
    Estimate estimate) {
  public JobResponse(
      String jobId,
      String type,
      String status,
      int progress,
      String currentStep,
      String entityType,
      Long entityId,
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
        null);
  }

  public static JobResponse from(GenerationJob job) {
    return from(job, null);
  }

  public static JobResponse from(GenerationJob job, Estimate estimate) {
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
        estimate);
  }

  private static JobTarget targetFor(GenerationJob job) {
    if (job.getChapterId() != null) {
      return new JobTarget("CHAPTER", job.getChapterId());
    }
    if (job.getStoryVersionId() != null) {
      return new JobTarget("STORY_VERSION", job.getStoryVersionId());
    }
    return new JobTarget("PROJECT", job.getProjectId());
  }

  public record JobTarget(String type, Long id) {}

  public record Estimate(
      String currency,
      BigDecimal minimum,
      BigDecimal expected,
      BigDecimal maximum,
      BigDecimal maxAuthorized) {}
}
