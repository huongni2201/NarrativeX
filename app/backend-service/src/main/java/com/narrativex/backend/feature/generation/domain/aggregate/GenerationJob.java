package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.Objects;
import java.util.UUID;

/** Durable generation job aggregate. */
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
  private final Long storyVersionId;
  private final Long chapterId;
  private final Long storyboardRevisionId;
  private final Long chapterRowVersion;
  private final String sourceHash;
  private final String sourceText;
  private final String sourceLanguage;
  private final String idempotencyKey;

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
      String billedToUserId,
      Long storyVersionId,
      Long chapterId,
      Long storyboardRevisionId,
      Long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey) {
    super(id, rowVersion);
    this.jobId = required(jobId, "jobId");
    if (projectId == null || projectId <= 0) throw new IllegalArgumentException("projectId must be positive");
    this.projectId = projectId;
    this.type = Objects.requireNonNull(type, "type");
    this.status = Objects.requireNonNull(status, "status");
    this.resourceClass = Objects.requireNonNull(resourceClass, "resourceClass");
    if (progress < 0 || progress > 100) throw new IllegalArgumentException("progress must be between 0 and 100");
    this.progress = progress;
    this.currentStep = currentStep;
    this.errorCode = errorCode;
    this.requestedByUserId = required(requestedByUserId, "requestedByUserId");
    this.billedToUserId = required(billedToUserId, "billedToUserId");
    this.storyVersionId = storyVersionId;
    this.chapterId = chapterId;
    this.storyboardRevisionId = storyboardRevisionId;
    this.chapterRowVersion = chapterRowVersion;
    this.sourceHash = sourceHash;
    this.sourceText = sourceText;
    this.sourceLanguage = sourceLanguage;
    this.idempotencyKey = idempotencyKey;
  }

  public static GenerationJob create(Long projectId, JobType type, ResourceClass resourceClass, String userId) {
    return new GenerationJob(null, 0L, UUID.randomUUID().toString(), projectId, type, JobStatus.QUEUED,
        resourceClass, 0, "QUEUED", null, userId, userId, null, null, null, null, null, null, null, null);
  }

  public static GenerationJob createChapterAnalysis(
      Long projectId,
      Long storyVersionId,
      Long chapterId,
      Long storyboardRevisionId,
      long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      String userId) {
    if (storyVersionId == null || storyVersionId <= 0) throw new IllegalArgumentException("storyVersionId must be positive");
    if (chapterId == null || chapterId <= 0) throw new IllegalArgumentException("chapterId must be positive");
    if (storyboardRevisionId == null || storyboardRevisionId <= 0) throw new IllegalArgumentException("storyboardRevisionId must be positive");
    if (chapterRowVersion < 0) throw new IllegalArgumentException("chapterRowVersion must not be negative");
    return new GenerationJob(null, 0L, UUID.randomUUID().toString(), projectId, JobType.CHAPTER_ANALYZE,
        JobStatus.QUEUED, ResourceClass.PROVIDER_INTERACTIVE, 0, "QUEUED", null, userId, userId,
        storyVersionId, chapterId, storyboardRevisionId, chapterRowVersion, required(sourceHash, "sourceHash"),
        required(sourceText, "sourceText"), required(sourceLanguage, "sourceLanguage"), required(idempotencyKey, "idempotencyKey"));
  }

  public static GenerationJob rehydrate(
      Long id, long rowVersion, String jobId, Long projectId, JobType type, JobStatus status,
      ResourceClass resourceClass, int progress, String currentStep, String errorCode,
      String requestedByUserId, String billedToUserId) {
    return rehydrate(id, rowVersion, jobId, projectId, type, status, resourceClass, progress, currentStep,
        errorCode, requestedByUserId, billedToUserId, null, null, null, null, null, null, null, null);
  }

  public static GenerationJob rehydrate(
      Long id, long rowVersion, String jobId, Long projectId, JobType type, JobStatus status,
      ResourceClass resourceClass, int progress, String currentStep, String errorCode,
      String requestedByUserId, String billedToUserId, Long storyVersionId, Long chapterId,
      Long storyboardRevisionId, Long chapterRowVersion, String sourceHash, String sourceText,
      String sourceLanguage, String idempotencyKey) {
    return new GenerationJob(id, rowVersion, jobId, projectId, type, status, resourceClass, progress,
        currentStep, errorCode, requestedByUserId, billedToUserId, storyVersionId, chapterId,
        storyboardRevisionId, chapterRowVersion, sourceHash, sourceText, sourceLanguage, idempotencyKey);
  }

  public String getJobId() { return jobId; }
  public Long getProjectId() { return projectId; }
  public JobType getType() { return type; }
  public JobStatus getStatus() { return status; }
  public ResourceClass getResourceClass() { return resourceClass; }
  public int getProgress() { return progress; }
  public String getCurrentStep() { return currentStep; }
  public String getErrorCode() { return errorCode; }
  public String getRequestedByUserId() { return requestedByUserId; }
  public String getBilledToUserId() { return billedToUserId; }
  public Long getStoryVersionId() { return storyVersionId; }
  public Long getChapterId() { return chapterId; }
  public Long getStoryboardRevisionId() { return storyboardRevisionId; }
  public Long getChapterRowVersion() { return chapterRowVersion; }
  public String getSourceHash() { return sourceHash; }
  public String getSourceText() { return sourceText; }
  public String getSourceLanguage() { return sourceLanguage; }
  public String getIdempotencyKey() { return idempotencyKey; }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
