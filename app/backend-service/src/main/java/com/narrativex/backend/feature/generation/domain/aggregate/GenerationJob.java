package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.Objects;
import java.util.UUID;

/**
 * Durable generation job aggregate; project ownership is represented by an ID, not a cross-module
 * entity link.
 */
public final class GenerationJob extends AggregateRoot {
  private final String jobId;
  private final Long projectId;
  private final JobType type;
  private JobStatus status;
  private final ResourceClass resourceClass;
  private final int progress;
  private final String currentStep;
  private final String errorCode;
  private final String requestedByUserId;
  private final String billedToUserId;

  private GenerationJob(
      Long id,
      long rowVersion,
      String jobId,
      Long projectId,
      JobType type,
      JobStatus status,
      ResourceClass resourceClass,
      int progress,
      String currentStep,
      String errorCode,
      String requestedByUserId,
      String billedToUserId) {
    super(id, rowVersion);
    this.jobId = required(jobId, "jobId");
    if (projectId == null || projectId <= 0)
      throw new IllegalArgumentException("projectId must be positive");
    this.projectId = projectId;
    this.type = Objects.requireNonNull(type, "type");
    this.status = Objects.requireNonNull(status, "status");
    this.resourceClass = Objects.requireNonNull(resourceClass, "resourceClass");
    if (progress < 0 || progress > 100)
      throw new IllegalArgumentException("progress must be between 0 and 100");
    this.progress = progress;
    this.currentStep = currentStep;
    this.errorCode = errorCode;
    this.requestedByUserId = required(requestedByUserId, "requestedByUserId");
    this.billedToUserId = required(billedToUserId, "billedToUserId");
  }

  public static GenerationJob create(
      Long projectId, JobType type, ResourceClass resourceClass, String userId) {
    return new GenerationJob(
        null,
        0L,
        UUID.randomUUID().toString(),
        projectId,
        type,
        JobStatus.QUEUED,
        resourceClass,
        0,
        "QUEUED",
        null,
        userId,
        userId);
  }

  public static GenerationJob rehydrate(
      Long id,
      long rowVersion,
      String jobId,
      Long projectId,
      JobType type,
      JobStatus status,
      ResourceClass resourceClass,
      int progress,
      String currentStep,
      String errorCode,
      String requestedByUserId,
      String billedToUserId) {
    return new GenerationJob(
        id,
        rowVersion,
        jobId,
        projectId,
        type,
        status,
        resourceClass,
        progress,
        currentStep,
        errorCode,
        requestedByUserId,
        billedToUserId);
  }

  public String getJobId() {
    return jobId;
  }

  public Long getProjectId() {
    return projectId;
  }

  public JobType getType() {
    return type;
  }

  public JobStatus getStatus() {
    return status;
  }

  public ResourceClass getResourceClass() {
    return resourceClass;
  }

  public int getProgress() {
    return progress;
  }

  public String getCurrentStep() {
    return currentStep;
  }

  public String getErrorCode() {
    return errorCode;
  }

  public String getRequestedByUserId() {
    return requestedByUserId;
  }

  public String getBilledToUserId() {
    return billedToUserId;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
