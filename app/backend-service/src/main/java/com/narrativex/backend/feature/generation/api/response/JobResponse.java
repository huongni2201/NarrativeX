package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;

public record JobResponse(
    String jobId,
    String type,
    String status,
    int progress,
    String currentStep,
    String entityType,
    Long entityId,
    JobTarget target,
    String errorCode) {
  public static JobResponse from(GenerationJob job) {
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
        job.getErrorCode());
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
}
