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

  // Orchestration and reconciliation fields
  private final String submissionState;
  private final UUID computeAttemptId;
  private final String computeExecutionHandle;
  private final Long computeSequence;
  private final String lastComputeState;
  private final Instant submittedAt;
  private final Instant startedAt;
  private final Instant completedAt;
  private final Instant lastReconciledAt;
  private final Instant nextReconcileAt;
  private final int reconcileAttemptCount;
  private final String lastEventId;
  private final Long lastEventSequence;
  private final Instant callbackReceivedAt;

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
    requireCompleteMediaPlanPointer(mediaPlanId, mediaPlanRevision, productionMode);
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

  public String getSubmissionState() {
    return submissionState;
  }

  public UUID getComputeAttemptId() {
    return computeAttemptId;
  }

  public String getComputeExecutionHandle() {
    return computeExecutionHandle;
  }

  public Long getComputeSequence() {
    return computeSequence;
  }

  public String getLastComputeState() {
    return lastComputeState;
  }

  public Instant getSubmittedAt() {
    return submittedAt;
  }

  public Instant getStartedAt() {
    return startedAt;
  }

  public Instant getCompletedAt() {
    return completedAt;
  }

  public Instant getLastReconciledAt() {
    return lastReconciledAt;
  }

  public Instant getNextReconcileAt() {
    return nextReconcileAt;
  }

  public int getReconcileAttemptCount() {
    return reconcileAttemptCount;
  }

  public String getLastEventId() {
    return lastEventId;
  }

  public Long getLastEventSequence() {
    return lastEventSequence;
  }

  public Instant getCallbackReceivedAt() {
    return callbackReceivedAt;
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
      String step,
      int progress,
      Long sequence,
      String computeState,
      String executionHandle) {
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
        .build();
  }

  public GenerationJob markUnknown(String errorCode, String step) {
    return toBuilder()
        .status(JobStatus.UNKNOWN)
        .errorCode(errorCode)
        .currentStep(step)
        .build();
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

  public Builder toBuilder() {
    return new Builder()
        .id(getId())
        .rowVersion(getRowVersion())
        .jobId(this.jobId)
        .projectId(this.projectId)
        .type(this.type)
        .status(this.status)
        .resourceClass(this.resourceClass)
        .progress(this.progress)
        .currentStep(this.currentStep)
        .errorCode(this.errorCode)
        .storyVersionId(this.storyVersionId)
        .chapterId(this.chapterId)
        .storyboardRevisionId(this.storyboardRevisionId)
        .chapterRowVersion(this.chapterRowVersion)
        .sourceHash(this.sourceHash)
        .sourceText(this.sourceText)
        .sourceLanguage(this.sourceLanguage)
        .idempotencyKey(this.idempotencyKey)
        .mediaPlanId(this.mediaPlanId)
        .mediaPlanRevision(this.mediaPlanRevision)
        .productionMode(this.productionMode)
        .analysisVisualGenerationMode(this.analysisVisualGenerationMode)
        .analysisImageProvider(this.analysisImageProvider)
        .submissionState(this.submissionState)
        .computeAttemptId(this.computeAttemptId)
        .computeExecutionHandle(this.computeExecutionHandle)
        .computeSequence(this.computeSequence)
        .lastComputeState(this.lastComputeState)
        .submittedAt(this.submittedAt)
        .startedAt(this.startedAt)
        .completedAt(this.completedAt)
        .lastReconciledAt(this.lastReconciledAt)
        .nextReconcileAt(this.nextReconcileAt)
        .reconcileAttemptCount(this.reconcileAttemptCount)
        .lastEventId(this.lastEventId)
        .lastEventSequence(this.lastEventSequence)
        .callbackReceivedAt(this.callbackReceivedAt);
  }

  public static final class Builder {
    private UUID id;
    private long rowVersion;
    private UUID jobId;
    private UUID projectId;
    private JobType type;
    private JobStatus status;
    private ResourceClass resourceClass;
    private int progress;
    private String currentStep;
    private String errorCode;
    private UUID storyVersionId;
    private UUID chapterId;
    private UUID storyboardRevisionId;
    private Long chapterRowVersion;
    private String sourceHash;
    private String sourceText;
    private String sourceLanguage;
    private String idempotencyKey;
    private UUID mediaPlanId;
    private Integer mediaPlanRevision;
    private ProductionMode productionMode;
    private String analysisVisualGenerationMode;
    private String analysisImageProvider;
    private String submissionState;
    private UUID computeAttemptId;
    private String computeExecutionHandle;
    private Long computeSequence;
    private String lastComputeState;
    private Instant submittedAt;
    private Instant startedAt;
    private Instant completedAt;
    private Instant lastReconciledAt;
    private Instant nextReconcileAt;
    private int reconcileAttemptCount;
    private String lastEventId;
    private Long lastEventSequence;
    private Instant callbackReceivedAt;

    public Builder id(UUID id) { this.id = id; return this; }
    public Builder rowVersion(long rowVersion) { this.rowVersion = rowVersion; return this; }
    public Builder jobId(UUID jobId) { this.jobId = jobId; return this; }
    public Builder projectId(UUID projectId) { this.projectId = projectId; return this; }
    public Builder type(JobType type) { this.type = type; return this; }
    public Builder status(JobStatus status) { this.status = status; return this; }
    public Builder resourceClass(ResourceClass resourceClass) { this.resourceClass = resourceClass; return this; }
    public Builder progress(int progress) { this.progress = progress; return this; }
    public Builder currentStep(String currentStep) { this.currentStep = currentStep; return this; }
    public Builder errorCode(String errorCode) { this.errorCode = errorCode; return this; }
    public Builder storyVersionId(UUID storyVersionId) { this.storyVersionId = storyVersionId; return this; }
    public Builder chapterId(UUID chapterId) { this.chapterId = chapterId; return this; }
    public Builder storyboardRevisionId(UUID storyboardRevisionId) { this.storyboardRevisionId = storyboardRevisionId; return this; }
    public Builder chapterRowVersion(Long chapterRowVersion) { this.chapterRowVersion = chapterRowVersion; return this; }
    public Builder sourceHash(String sourceHash) { this.sourceHash = sourceHash; return this; }
    public Builder sourceText(String sourceText) { this.sourceText = sourceText; return this; }
    public Builder sourceLanguage(String sourceLanguage) { this.sourceLanguage = sourceLanguage; return this; }
    public Builder idempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; return this; }
    public Builder mediaPlanId(UUID mediaPlanId) { this.mediaPlanId = mediaPlanId; return this; }
    public Builder mediaPlanRevision(Integer mediaPlanRevision) { this.mediaPlanRevision = mediaPlanRevision; return this; }
    public Builder productionMode(ProductionMode productionMode) { this.productionMode = productionMode; return this; }
    public Builder analysisVisualGenerationMode(String mode) { this.analysisVisualGenerationMode = mode; return this; }
    public Builder analysisImageProvider(String provider) { this.analysisImageProvider = provider; return this; }
    public Builder submissionState(String submissionState) { this.submissionState = submissionState; return this; }
    public Builder computeAttemptId(UUID computeAttemptId) { this.computeAttemptId = computeAttemptId; return this; }
    public Builder computeExecutionHandle(String handle) { this.computeExecutionHandle = handle; return this; }
    public Builder computeSequence(Long computeSequence) { this.computeSequence = computeSequence; return this; }
    public Builder lastComputeState(String lastComputeState) { this.lastComputeState = lastComputeState; return this; }
    public Builder submittedAt(Instant submittedAt) { this.submittedAt = submittedAt; return this; }
    public Builder startedAt(Instant startedAt) { this.startedAt = startedAt; return this; }
    public Builder completedAt(Instant completedAt) { this.completedAt = completedAt; return this; }
    public Builder lastReconciledAt(Instant lastReconciledAt) { this.lastReconciledAt = lastReconciledAt; return this; }
    public Builder nextReconcileAt(Instant nextReconcileAt) { this.nextReconcileAt = nextReconcileAt; return this; }
    public Builder reconcileAttemptCount(int count) { this.reconcileAttemptCount = count; return this; }
    public Builder lastEventId(String lastEventId) { this.lastEventId = lastEventId; return this; }
    public Builder lastEventSequence(Long lastEventSequence) { this.lastEventSequence = lastEventSequence; return this; }
    public Builder callbackReceivedAt(Instant receivedAt) { this.callbackReceivedAt = receivedAt; return this; }

    public GenerationJob build() {
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
