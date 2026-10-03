package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.Getter;

/** Durable generation job aggregate. */
public final class GenerationJob extends AggregateRoot {
  @Getter private final UUID jobId;
  @Getter private final UUID projectId;
  @Getter private final JobType type;
  @Getter private JobStatus status;
  @Getter private final ResourceClass resourceClass;
  @Getter private final int progress;
  @Getter private final String currentStep;
  @Getter private final String errorCode;
  @Getter private final UUID storyVersionId;
  @Getter private final UUID chapterId;
  @Getter private final UUID storyboardRevisionId;
  @Getter private final Long chapterRowVersion;
  @Getter private final String sourceHash;
  @Getter private final String sourceText;
  @Getter private final String sourceLanguage;
  @Getter private final String idempotencyKey;
  @Getter private final UUID mediaPlanId;
  @Getter private final Integer mediaPlanRevision;
  @Getter private final ProductionMode productionMode;
  @Getter private final String analysisVisualGenerationMode;
  @Getter private final String analysisImageProvider;

  // Orchestration and reconciliation fields
  @Getter private final String submissionState;
  @Getter private final UUID computeAttemptId;
  @Getter private final String computeExecutionHandle;
  @Getter private final Long computeSequence;
  @Getter private final String lastComputeState;
  @Getter private final Instant submittedAt;
  @Getter private final Instant startedAt;
  @Getter private final Instant completedAt;
  @Getter private final Instant lastReconciledAt;
  @Getter private final Instant nextReconcileAt;
  @Getter private final int reconcileAttemptCount;
  @Getter private final String lastEventId;
  @Getter private final Long lastEventSequence;
  @Getter private final Instant callbackReceivedAt;

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
        analysisImageProvider,
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
        0,
        null,
        null,
        null);
  }

  @lombok.Builder(toBuilder = true, builderClassName = "Builder", builderMethodName = "")
  private GenerationJob(
      @lombok.Builder.ObtainVia(method = "getId") UUID id,
      @lombok.Builder.ObtainVia(method = "getRowVersion") long rowVersion,
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
      String analysisImageProvider,
      String submissionState,
      UUID computeAttemptId,
      String computeExecutionHandle,
      Long computeSequence,
      String lastComputeState,
      Instant submittedAt,
      Instant startedAt,
      Instant completedAt,
      Instant lastReconciledAt,
      Instant nextReconcileAt,
      int reconcileAttemptCount,
      String lastEventId,
      Long lastEventSequence,
      Instant callbackReceivedAt) {
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
    requireCompleteMediaPlanPointer(mediaPlanId, mediaPlanRevision, productionMode, resourceClass);
    requireAnalysisPreferences(type, analysisVisualGenerationMode, analysisImageProvider);
    this.mediaPlanId = mediaPlanId;
    this.mediaPlanRevision = mediaPlanRevision;
    this.productionMode = productionMode;
    this.analysisVisualGenerationMode = analysisVisualGenerationMode;
    this.analysisImageProvider = analysisImageProvider;
    this.submissionState = submissionState;
    this.computeAttemptId = computeAttemptId;
    this.computeExecutionHandle = computeExecutionHandle;
    this.computeSequence = computeSequence;
    this.lastComputeState = lastComputeState;
    this.submittedAt = submittedAt;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.lastReconciledAt = lastReconciledAt;
    this.nextReconcileAt = nextReconcileAt;
    this.reconcileAttemptCount = reconcileAttemptCount;
    this.lastEventId = lastEventId;
    this.lastEventSequence = lastEventSequence;
    this.callbackReceivedAt = callbackReceivedAt;
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

  public static GenerationJob createShotVideoGeneration(
      UUID projectId,
      UUID storyVersionId,
      UUID chapterId,
      String sourceText,
      String idempotencyKey) {
    return new GenerationJob(
        null,
        0L,
        UuidV7.random(),
        projectId,
        JobType.CHAPTER_GENERATE,
        JobStatus.QUEUED,
        ResourceClass.GPU_HEAVY,
        0,
        "QUEUED",
        null,
        storyVersionId,
        chapterId,
        null,
        null,
        null,
        sourceText,
        "en",
        idempotencyKey,
        null,
        null,
        ProductionMode.VIDEO_FIRST,
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
        analysisVisualGenerationMode,
        analysisImageProvider,
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
        0,
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
      ProductionMode productionMode,
      String analysisVisualGenerationMode,
      String analysisImageProvider,
      String submissionState,
      UUID computeAttemptId,
      String computeExecutionHandle,
      Long computeSequence,
      String lastComputeState,
      Instant submittedAt,
      Instant startedAt,
      Instant completedAt,
      Instant lastReconciledAt,
      Instant nextReconcileAt,
      int reconcileAttemptCount,
      String lastEventId,
      Long lastEventSequence,
      Instant callbackReceivedAt) {
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
        analysisImageProvider,
        submissionState,
        computeAttemptId,
        computeExecutionHandle,
        computeSequence,
        lastComputeState,
        submittedAt,
        startedAt,
        completedAt,
        lastReconciledAt,
        nextReconcileAt,
        reconcileAttemptCount,
        lastEventId,
        lastEventSequence,
        callbackReceivedAt);
  }

  public GenerationJob markSubmitting(String step) {
    return toBuilder()
        .status(JobStatus.SUBMITTING)
        .currentStep(step)
        .submissionState("SUBMITTING")
        .build();
  }

  public GenerationJob markSubmitted(
      UUID computeAttemptId,
      String computeExecutionHandle,
      Long computeSequence,
      Instant submittedAt,
      Instant nextReconcileAt) {
    return toBuilder()
        .status(JobStatus.SUBMITTED)
        .currentStep("SUBMITTED")
        .submissionState("SUBMITTED")
        .computeAttemptId(computeAttemptId)
        .computeExecutionHandle(computeExecutionHandle)
        .computeSequence(computeSequence)
        .lastComputeState("ACCEPTED")
        .submittedAt(submittedAt)
        .nextReconcileAt(nextReconcileAt)
        .reconcileAttemptCount(0)
        .build();
  }

  public boolean isChapterVideoBatch() {
    return type == JobType.CHAPTER_GENERATE
        && productionMode == ProductionMode.VIDEO_FIRST
        && resourceClass == ResourceClass.BACKGROUND
        && mediaPlanId != null;
  }

  public GenerationJob markRunning(String step, int progress) {
    Instant now = Instant.now();
    return toBuilder()
        .status(JobStatus.RUNNING)
        .currentStep(step)
        .progress(progress)
        .errorCode(null)
        .startedAt(this.startedAt != null ? this.startedAt : now)
        .build();
  }

  public GenerationJob markRunningWithCompute(
      String step, int progress, Long sequence, String computeState, String executionHandle) {
    Instant now = Instant.now();
    return toBuilder()
        .status(JobStatus.RUNNING)
        .currentStep(step)
        .progress(progress)
        .errorCode(null)
        .computeSequence(sequence != null ? sequence : this.computeSequence)
        .lastComputeState(computeState != null ? computeState : this.lastComputeState)
        .computeExecutionHandle(
            executionHandle != null ? executionHandle : this.computeExecutionHandle)
        .startedAt(this.startedAt != null ? this.startedAt : now)
        .build();
  }

  public GenerationJob markCompleted(String step) {
    Instant now = Instant.now();
    return toBuilder()
        .status(JobStatus.COMPLETED)
        .currentStep(step)
        .progress(100)
        .errorCode(null)
        .lastComputeState("SUCCEEDED")
        .completedAt(this.completedAt != null ? this.completedAt : now)
        .nextReconcileAt(null)
        .build();
  }

  public GenerationJob markFailed(String errorCode, String step) {
    Instant now = Instant.now();
    return toBuilder()
        .status(JobStatus.FAILED)
        .errorCode(errorCode)
        .currentStep(step)
        .lastComputeState("FAILED")
        .completedAt(this.completedAt != null ? this.completedAt : now)
        .nextReconcileAt(null)
        .build();
  }

  public GenerationJob markCanceled(String errorCode, String step) {
    Instant now = Instant.now();
    return toBuilder()
        .status(JobStatus.CANCELED)
        .errorCode(errorCode)
        .currentStep(step)
        .lastComputeState("CANCELED")
        .completedAt(this.completedAt != null ? this.completedAt : now)
        .nextReconcileAt(null)
        .build();
  }

  public GenerationJob markUnknown(String errorCode, String step) {
    return toBuilder().status(JobStatus.UNKNOWN).errorCode(errorCode).currentStep(step).build();
  }

  public GenerationJob markUnknown(String errorCode, String step, Instant nextReconcileAt) {
    return toBuilder()
        .status(JobStatus.UNKNOWN)
        .errorCode(errorCode)
        .currentStep(step)
        .nextReconcileAt(nextReconcileAt)
        .build();
  }

  public GenerationJob markReconciling(String step, Instant nextReconcileAt) {
    return toBuilder()
        .status(JobStatus.RECONCILING)
        .currentStep(step)
        .nextReconcileAt(nextReconcileAt)
        .build();
  }

  public GenerationJob recordReconciliationAttempt(Instant nextReconcileAt, Instant reconciledAt) {
    return toBuilder()
        .reconcileAttemptCount(this.reconcileAttemptCount + 1)
        .lastReconciledAt(reconciledAt)
        .nextReconcileAt(nextReconcileAt)
        .build();
  }

  public GenerationJob recordCallback(String eventId, Long eventSequence, Instant receivedAt) {
    return toBuilder()
        .lastEventId(eventId)
        .lastEventSequence(eventSequence)
        .callbackReceivedAt(receivedAt)
        .build();
  }

  public static final class Builder {
    public Builder() {}

    @Override
    public String toString() {
      return "GenerationJob.Builder";
    }
  }

  private static void requireCompleteMediaPlanPointer(
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      ProductionMode productionMode,
      ResourceClass resourceClass) {
    boolean allNull = mediaPlanId == null && mediaPlanRevision == null && productionMode == null;
    boolean allPresent = mediaPlanId != null && mediaPlanRevision != null && productionMode != null;
    boolean standaloneVideo =
        mediaPlanId == null
            && mediaPlanRevision == null
            && productionMode == ProductionMode.VIDEO_FIRST
            && resourceClass == ResourceClass.GPU_HEAVY;
    if (!allNull && !allPresent && !standaloneVideo) {
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
