package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
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
  private final UUID mediaPlanId;
  private final Integer mediaPlanRevision;
  private final ProductionMode productionMode;
  private final Long contentVariantId;
  private final Long sourceVariantId;
  private final String targetLanguage;

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
      String idempotencyKey,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode) {
    this(
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
        billedToUserId,
        storyVersionId,
        chapterId,
        storyboardRevisionId,
        chapterRowVersion,
        sourceHash,
        sourceText,
        sourceLanguage,
        idempotencyKey,
        mediaPlanId,
        mediaPlanRevision,
        productionMode,
        null,
        null,
        null);
  }

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
      String idempotencyKey,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode,
      Long contentVariantId,
      Long sourceVariantId,
      String targetLanguage) {
    super(id, rowVersion);
    this.jobId = required(jobId, "jobId");
    if (projectId == null || projectId <= 0) {
      throw new IllegalArgumentException("projectId must be positive");
    }
    this.projectId = projectId;
    this.type = Objects.requireNonNull(type, "type");
    this.status = Objects.requireNonNull(status, "status");
    this.resourceClass = Objects.requireNonNull(resourceClass, "resourceClass");
    if (progress < 0 || progress > 100) {
      throw new IllegalArgumentException("progress must be between 0 and 100");
    }
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
    requireCompleteMediaPlanPointer(mediaPlanId, mediaPlanRevision, productionMode);
    this.mediaPlanId = mediaPlanId;
    this.mediaPlanRevision = mediaPlanRevision;
    this.productionMode = productionMode;
    this.contentVariantId = contentVariantId;
    this.sourceVariantId = sourceVariantId;
    this.targetLanguage = targetLanguage;
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
        userId,
        null,
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
    return createChapterAnalysis(
        projectId,
        storyVersionId,
        chapterId,
        storyboardRevisionId,
        chapterRowVersion,
        sourceHash,
        sourceText,
        sourceLanguage,
        idempotencyKey,
        userId,
        null);
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
      String userId,
      Long contentVariantId) {
    if (storyVersionId == null || storyVersionId <= 0) {
      throw new IllegalArgumentException("storyVersionId must be positive");
    }
    if (chapterId == null || chapterId <= 0) {
      throw new IllegalArgumentException("chapterId must be positive");
    }
    if (storyboardRevisionId == null || storyboardRevisionId <= 0) {
      throw new IllegalArgumentException("storyboardRevisionId must be positive");
    }
    if (chapterRowVersion < 0) {
      throw new IllegalArgumentException("chapterRowVersion must not be negative");
    }
    return new GenerationJob(
        null,
        0L,
        UUID.randomUUID().toString(),
        projectId,
        JobType.CHAPTER_ANALYZE,
        JobStatus.QUEUED,
        ResourceClass.PROVIDER_INTERACTIVE,
        0,
        "QUEUED",
        null,
        userId,
        userId,
        storyVersionId,
        chapterId,
        storyboardRevisionId,
        chapterRowVersion,
        required(sourceHash, "sourceHash"),
        required(sourceText, "sourceText"),
        required(sourceLanguage, "sourceLanguage"),
        required(idempotencyKey, "idempotencyKey"),
        null,
        null,
        null,
        contentVariantId,
        contentVariantId,
        null);
  }

  public static GenerationJob createChapterTranslation(
      Long projectId,
      Long storyVersionId,
      Long chapterId,
      Long sourceVariantId,
      long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String targetLanguage,
      String idempotencyKey,
      String userId) {
    return new GenerationJob(
        null,
        0L,
        UUID.randomUUID().toString(),
        projectId,
        JobType.CHAPTER_TRANSLATE,
        JobStatus.QUEUED,
        ResourceClass.PROVIDER_INTERACTIVE,
        0,
        "QUEUED",
        null,
        userId,
        userId,
        storyVersionId,
        chapterId,
        null,
        chapterRowVersion,
        required(sourceHash, "sourceHash"),
        required(sourceText, "sourceText"),
        required(sourceLanguage, "sourceLanguage"),
        required(idempotencyKey, "idempotencyKey"),
        null,
        null,
        null,
        sourceVariantId,
        sourceVariantId,
        required(targetLanguage, "targetLanguage"));
  }

  /** Creates a media job that can only execute the exact persisted media-plan revision supplied. */
  public static GenerationJob createChapterGeneration(
      Long projectId,
      Long storyVersionId,
      MediaPlan mediaPlan,
      ResourceClass resourceClass,
      String sourceLanguage,
      String idempotencyKey,
      String userId) {
    Objects.requireNonNull(mediaPlan, "mediaPlan");
    if (storyVersionId == null || storyVersionId <= 0) {
      throw new IllegalArgumentException("storyVersionId must be positive");
    }
    return new GenerationJob(
        null,
        0L,
        UUID.randomUUID().toString(),
        projectId,
        JobType.CHAPTER_GENERATE,
        JobStatus.QUEUED,
        Objects.requireNonNull(resourceClass, "resourceClass"),
        0,
        "QUEUED",
        null,
        userId,
        userId,
        storyVersionId,
        mediaPlan.chapterId(),
        null,
        mediaPlan.chapterRowVersion(),
        mediaPlan.sourceHash(),
        null,
        required(sourceLanguage, "sourceLanguage"),
        required(idempotencyKey, "idempotencyKey"),
        mediaPlan.id(),
        mediaPlan.revision(),
        mediaPlan.productionMode());
  }

  public static GenerationJob createChapterRender(
      Long projectId,
      Long storyVersionId,
      Long chapterId,
      long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      String userId) {
    if (storyVersionId == null || storyVersionId <= 0) {
      throw new IllegalArgumentException("storyVersionId must be positive");
    }
    if (chapterId == null || chapterId <= 0) {
      throw new IllegalArgumentException("chapterId must be positive");
    }
    if (chapterRowVersion < 0) {
      throw new IllegalArgumentException("chapterRowVersion must not be negative");
    }
    if (mediaPlanId == null || mediaPlanRevision == null || mediaPlanRevision <= 0) {
      throw new IllegalArgumentException("A pinned media plan revision is required for rendering");
    }
    return new GenerationJob(
        null,
        0L,
        UUID.randomUUID().toString(),
        projectId,
        JobType.CHAPTER_RENDER,
        JobStatus.QUEUED,
        ResourceClass.CPU_RENDER,
        0,
        "QUEUED",
        null,
        userId,
        userId,
        storyVersionId,
        chapterId,
        null,
        chapterRowVersion,
        required(sourceHash, "sourceHash"),
        required(sourceText, "sourceText"),
        required(sourceLanguage, "sourceLanguage"),
        required(idempotencyKey, "idempotencyKey"),
        mediaPlanId,
        mediaPlanRevision,
        ProductionMode.IMAGE_MOTION);
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
      String billedToUserId,
      Long storyVersionId,
      Long chapterId,
      Long storyboardRevisionId,
      Long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey) {
    return rehydrate(
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
        billedToUserId,
        storyVersionId,
        chapterId,
        storyboardRevisionId,
        chapterRowVersion,
        sourceHash,
        sourceText,
        sourceLanguage,
        idempotencyKey,
        null,
        null,
        null);
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
      String billedToUserId,
      Long storyVersionId,
      Long chapterId,
      Long storyboardRevisionId,
      Long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      Long contentVariantId,
      Long sourceVariantId,
      String targetLanguage,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode) {
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
        billedToUserId,
        storyVersionId,
        chapterId,
        storyboardRevisionId,
        chapterRowVersion,
        sourceHash,
        sourceText,
        sourceLanguage,
        idempotencyKey,
        mediaPlanId,
        mediaPlanRevision,
        productionMode,
        contentVariantId,
        sourceVariantId,
        targetLanguage);
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
      String billedToUserId,
      Long storyVersionId,
      Long chapterId,
      Long storyboardRevisionId,
      Long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode) {
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
        billedToUserId,
        storyVersionId,
        chapterId,
        storyboardRevisionId,
        chapterRowVersion,
        sourceHash,
        sourceText,
        sourceLanguage,
        idempotencyKey,
        mediaPlanId,
        mediaPlanRevision,
        productionMode);
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

  public Long getStoryVersionId() {
    return storyVersionId;
  }

  public Long getChapterId() {
    return chapterId;
  }

  public Long getStoryboardRevisionId() {
    return storyboardRevisionId;
  }

  public Long getChapterRowVersion() {
    return chapterRowVersion;
  }

  public String getSourceHash() {
    return sourceHash;
  }

  public String getSourceText() {
    return sourceText;
  }

  public String getSourceLanguage() {
    return sourceLanguage;
  }

  public String getIdempotencyKey() {
    return idempotencyKey;
  }

  public Long getContentVariantId() {
    return contentVariantId;
  }

  public Long getSourceVariantId() {
    return sourceVariantId;
  }

  public String getTargetLanguage() {
    return targetLanguage;
  }

  public UUID getMediaPlanId() {
    return mediaPlanId;
  }

  public Integer getMediaPlanRevision() {
    return mediaPlanRevision;
  }

  public ProductionMode getProductionMode() {
    return productionMode;
  }

  private static void requireCompleteMediaPlanPointer(
      UUID mediaPlanId, Integer mediaPlanRevision, ProductionMode productionMode) {
    boolean allNull = mediaPlanId == null && mediaPlanRevision == null && productionMode == null;
    boolean allPresent = mediaPlanId != null && mediaPlanRevision != null && productionMode != null;
    if (!allNull && !allPresent) {
      throw new IllegalArgumentException(
          "mediaPlanId, mediaPlanRevision, and productionMode must be set together");
    }
    if (mediaPlanRevision != null && mediaPlanRevision <= 0) {
      throw new IllegalArgumentException("mediaPlanRevision must be positive");
    }
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value;
  }
}
