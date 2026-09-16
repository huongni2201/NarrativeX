package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.Objects;
import java.util.UUID;

/** Durable generation job aggregate. */
public final class GenerationJob extends AggregateRoot {
  private final UUID jobId;
  private final UUID projectId;
  private final JobType type;
  private JobStatus status;
  private final ResourceClass resourceClass;
  private final int progress;
  private final String currentStep;
  private final String errorCode;
  private final UUID storyVersionId;
  private final UUID chapterId;
  private final UUID storyboardRevisionId;
  private final Long chapterRowVersion;
  private final String sourceHash;
  private final String sourceText;
  private final String sourceLanguage;
  private final String idempotencyKey;
  private final UUID mediaPlanId;
  private final Integer mediaPlanRevision;
  private final ProductionMode productionMode;
  private final String analysisVisualGenerationMode;
  private final String analysisImageProvider;

  private GenerationJob(
      UUID id,
      long rowVersion,
      UUID jobId,
      UUID projectId,
      JobType type,
      JobStatus status,
      ResourceClass resourceClass,
      int progress,
      String currentStep,
      String errorCode,
      UUID storyVersionId,
      UUID chapterId,
      UUID storyboardRevisionId,
      Long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode,
      String analysisVisualGenerationMode,
      String analysisImageProvider) {
    super(id, rowVersion);
    this.jobId = Objects.requireNonNull(jobId, "jobId");
    this.projectId = Objects.requireNonNull(projectId, "projectId");
    this.type = Objects.requireNonNull(type, "type");
    this.status = Objects.requireNonNull(status, "status");
    this.resourceClass = Objects.requireNonNull(resourceClass, "resourceClass");
    if (progress < 0 || progress > 100) {
      throw new IllegalArgumentException("progress must be between 0 and 100");
    }
    this.progress = progress;
    this.currentStep = currentStep;
    this.errorCode = errorCode;
    this.storyVersionId = storyVersionId;
    this.chapterId = chapterId;
    this.storyboardRevisionId = storyboardRevisionId;
    this.chapterRowVersion = chapterRowVersion;
    this.sourceHash = sourceHash;
    this.sourceText = sourceText;
    this.sourceLanguage = sourceLanguage;
    this.idempotencyKey = idempotencyKey;
    requireCompleteMediaPlanPointer(mediaPlanId, mediaPlanRevision, productionMode);
    requireAnalysisPreferences(type, analysisVisualGenerationMode, analysisImageProvider);
    this.mediaPlanId = mediaPlanId;
    this.mediaPlanRevision = mediaPlanRevision;
    this.productionMode = productionMode;
    this.analysisVisualGenerationMode = analysisVisualGenerationMode;
    this.analysisImageProvider = analysisImageProvider;
  }

  public static GenerationJob create(UUID projectId, JobType type, ResourceClass resourceClass) {
    return new GenerationJob(
        null,
        0L,
        UuidV7.random(),
        projectId,
        type,
        JobStatus.QUEUED,
        resourceClass,
        0,
        "QUEUED",
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
        null,
        null,
        null,
        null);
  }

  public static GenerationJob createChapterAnalysis(
      UUID projectId,
      UUID storyVersionId,
      UUID chapterId,
      UUID storyboardRevisionId,
      long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey) {
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
        "IMAGE",
        "API");
  }

  public static GenerationJob createChapterAnalysis(
      UUID projectId,
      UUID storyVersionId,
      UUID chapterId,
      UUID storyboardRevisionId,
      long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      String visualGenerationMode,
      String imageProvider) {
    Objects.requireNonNull(storyVersionId, "storyVersionId");
    Objects.requireNonNull(chapterId, "chapterId");
    Objects.requireNonNull(storyboardRevisionId, "storyboardRevisionId");
    if (chapterRowVersion < 0) {
      throw new IllegalArgumentException("chapterRowVersion must not be negative");
    }
    return new GenerationJob(
        null,
        0L,
        UuidV7.random(),
        projectId,
        JobType.CHAPTER_ANALYZE,
        JobStatus.QUEUED,
        ResourceClass.PROVIDER_INTERACTIVE,
        0,
        "QUEUED",
        null,
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
        required(visualGenerationMode, "visualGenerationMode"),
        imageProvider);
  }

  public static GenerationJob createChapterGeneration(
      UUID projectId,
      UUID storyVersionId,
      MediaPlan mediaPlan,
      ResourceClass resourceClass,
      String sourceLanguage,
      String idempotencyKey) {
    Objects.requireNonNull(mediaPlan, "mediaPlan");
    Objects.requireNonNull(storyVersionId, "storyVersionId");
    return new GenerationJob(
        null,
        0L,
        UuidV7.random(),
        projectId,
        JobType.CHAPTER_GENERATE,
        JobStatus.QUEUED,
        Objects.requireNonNull(resourceClass, "resourceClass"),
        0,
        "QUEUED",
        null,
        storyVersionId,
        mediaPlan.chapterId(),
        mediaPlan.storyboardRevisionId(),
        mediaPlan.chapterRowVersion(),
        mediaPlan.sourceHash(),
        null,
        required(sourceLanguage, "sourceLanguage"),
        required(idempotencyKey, "idempotencyKey"),
        mediaPlan.id(),
        mediaPlan.revision(),
        mediaPlan.productionMode(),
        null,
        null);
  }

  public static GenerationJob rehydrate(
      UUID id,
      long rowVersion,
      UUID jobId,
      UUID projectId,
      JobType type,
      JobStatus status,
      ResourceClass resourceClass,
      int progress,
      String currentStep,
      String errorCode,
      UUID storyVersionId,
      UUID chapterId,
      UUID storyboardRevisionId,
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
        null,
        null,
        null);
  }

  public static GenerationJob rehydrate(
      UUID id,
      long rowVersion,
      UUID jobId,
      UUID projectId,
      JobType type,
      JobStatus status,
      ResourceClass resourceClass,
      int progress,
      String currentStep,
      String errorCode,
      UUID storyVersionId,
      UUID chapterId,
      UUID storyboardRevisionId,
      Long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode) {
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
        null);
  }

  public static GenerationJob rehydrate(
      UUID id,
      long rowVersion,
      UUID jobId,
      UUID projectId,
      JobType type,
      JobStatus status,
      ResourceClass resourceClass,
      int progress,
      String currentStep,
      String errorCode,
      UUID storyVersionId,
      UUID chapterId,
      UUID storyboardRevisionId,
      Long chapterRowVersion,
      String sourceHash,
      String sourceText,
      String sourceLanguage,
      String idempotencyKey,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode,
      String analysisVisualGenerationMode,
      String analysisImageProvider) {
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
        analysisVisualGenerationMode,
        analysisImageProvider);
  }

  public UUID getJobId() {
    return jobId;
  }

  public UUID getProjectId() {
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

  public UUID getStoryVersionId() {
    return storyVersionId;
  }

  public UUID getChapterId() {
    return chapterId;
  }

  public UUID getStoryboardRevisionId() {
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

  public UUID getMediaPlanId() {
    return mediaPlanId;
  }

  public Integer getMediaPlanRevision() {
    return mediaPlanRevision;
  }

  public ProductionMode getProductionMode() {
    return productionMode;
  }

  public String getAnalysisVisualGenerationMode() {
    return analysisVisualGenerationMode;
  }

  public String getAnalysisImageProvider() {
    return analysisImageProvider;
  }

  public GenerationJob markRunning(String step, int progress) {
    return new GenerationJob(
        getId(),
        getRowVersion(),
        this.jobId,
        this.projectId,
        this.type,
        JobStatus.RUNNING,
        this.resourceClass,
        progress,
        step,
        null,
        this.storyVersionId,
        this.chapterId,
        this.storyboardRevisionId,
        this.chapterRowVersion,
        this.sourceHash,
        this.sourceText,
        this.sourceLanguage,
        this.idempotencyKey,
        this.mediaPlanId,
        this.mediaPlanRevision,
        this.productionMode,
        this.analysisVisualGenerationMode,
        this.analysisImageProvider);
  }

  public GenerationJob markCompleted(String step) {
    return new GenerationJob(
        getId(),
        getRowVersion(),
        this.jobId,
        this.projectId,
        this.type,
        JobStatus.COMPLETED,
        this.resourceClass,
        100,
        step,
        null,
        this.storyVersionId,
        this.chapterId,
        this.storyboardRevisionId,
        this.chapterRowVersion,
        this.sourceHash,
        this.sourceText,
        this.sourceLanguage,
        this.idempotencyKey,
        this.mediaPlanId,
        this.mediaPlanRevision,
        this.productionMode,
        this.analysisVisualGenerationMode,
        this.analysisImageProvider);
  }

  public GenerationJob markFailed(String errorCode, String step) {
    return new GenerationJob(
        getId(),
        getRowVersion(),
        this.jobId,
        this.projectId,
        this.type,
        JobStatus.FAILED,
        this.resourceClass,
        this.progress,
        step,
        errorCode,
        this.storyVersionId,
        this.chapterId,
        this.storyboardRevisionId,
        this.chapterRowVersion,
        this.sourceHash,
        this.sourceText,
        this.sourceLanguage,
        this.idempotencyKey,
        this.mediaPlanId,
        this.mediaPlanRevision,
        this.productionMode,
        this.analysisVisualGenerationMode,
        this.analysisImageProvider);
  }

  public GenerationJob markCanceled(String errorCode, String step) {
    return new GenerationJob(
        getId(),
        getRowVersion(),
        this.jobId,
        this.projectId,
        this.type,
        JobStatus.CANCELED,
        this.resourceClass,
        this.progress,
        step,
        errorCode,
        this.storyVersionId,
        this.chapterId,
        this.storyboardRevisionId,
        this.chapterRowVersion,
        this.sourceHash,
        this.sourceText,
        this.sourceLanguage,
        this.idempotencyKey,
        this.mediaPlanId,
        this.mediaPlanRevision,
        this.productionMode,
        this.analysisVisualGenerationMode,
        this.analysisImageProvider);
  }

  public GenerationJob markUnknown(String errorCode, String step) {
    return new GenerationJob(
        getId(),
        getRowVersion(),
        this.jobId,
        this.projectId,
        this.type,
        JobStatus.UNKNOWN,
        this.resourceClass,
        this.progress,
        step,
        errorCode,
        this.storyVersionId,
        this.chapterId,
        this.storyboardRevisionId,
        this.chapterRowVersion,
        this.sourceHash,
        this.sourceText,
        this.sourceLanguage,
        this.idempotencyKey,
        this.mediaPlanId,
        this.mediaPlanRevision,
        this.productionMode,
        this.analysisVisualGenerationMode,
        this.analysisImageProvider);
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

  private static void requireAnalysisPreferences(
      JobType type, String visualGenerationMode, String imageProvider) {
    if (visualGenerationMode == null && imageProvider == null) return;
    if (type != JobType.CHAPTER_ANALYZE) {
      throw new IllegalArgumentException(
          "analysis preferences are only valid for CHAPTER_ANALYZE jobs");
    }
    if (!"IMAGE".equals(visualGenerationMode) && !"VIDEO".equals(visualGenerationMode)) {
      throw new IllegalArgumentException("visualGenerationMode must be IMAGE or VIDEO");
    }
    if ("IMAGE".equals(visualGenerationMode)) {
      if (!"API".equals(imageProvider)) {
        throw new IllegalArgumentException("imageProvider must be API for IMAGE mode");
      }
      return;
    }
    if (imageProvider != null) {
      throw new IllegalArgumentException("imageProvider must be null for VIDEO mode");
    }
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value;
  }
}
