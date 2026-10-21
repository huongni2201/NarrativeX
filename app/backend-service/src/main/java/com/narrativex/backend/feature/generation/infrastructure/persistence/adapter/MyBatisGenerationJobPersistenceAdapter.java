package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationJobMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationJobRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisGenerationJobPersistenceAdapter implements GenerationJobRepository {
  private final GenerationJobMapper mapper;
  private final TakeMapper takeMapper;

  @Override
  public GenerationJob save(GenerationJob job) {
    return job.getId() == null ? create(job) : update(job);
  }

  private GenerationJob create(GenerationJob job) {
    UUID id = mapper.insert(toRow(job));
    if (id == null) throw new IllegalStateException("Inserted generation job did not return an id");
    return requireInserted(id);
  }

  private GenerationJob update(GenerationJob job) {
    if (mapper.updateCas(toRow(job)) != 1) {
      GenerationJobRow current = mapper.findById(job.getId());
      if (current == null) throw missing(job.getId());
      throw optimisticConflict(job.getId());
    }
    GenerationJobRow updated = mapper.findById(job.getId());
    if (updated == null) throw missing(job.getId());
    closeOpenTakes(updated);
    return toDomain(updated);
  }

  /**
   * Every path that ends a job without a result (compute failure, dispatch failure, cancellation,
   * reconciliation) saves it here, so Takes cannot stay PENDING or RUNNING behind a closed job.
   * Successful jobs are finalized together with their Take by the result finalizer.
   */
  private void closeOpenTakes(GenerationJobRow updated) {
    JobStatus status = updated.getStatus();
    if (status != JobStatus.FAILED && status != JobStatus.CANCELED) return;
    String reason =
        status == JobStatus.CANCELED
            ? "Generation was canceled before a result was produced"
            : "Generation failed before a result was produced"
                + (updated.getErrorCode() == null ? "" : " (" + updated.getErrorCode() + ")");
    if (takeMapper.closeOpenTakesForJob(updated.getId(), reason) > 0) {
      var take = takeMapper.findByGenerationJobId(updated.getId());
      if (take != null) takeMapper.refreshShotStatus(take.getId());
    }
  }

  @Override
  public Optional<GenerationJob> findById(UUID id) {
    return Optional.ofNullable(mapper.findById(id))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<GenerationJob> findByJobId(UUID jobId) {
    return Optional.ofNullable(mapper.findByJobId(jobId))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<GenerationJob> findByComputeAttempt(UUID taskId, UUID attemptId) {
    return Optional.ofNullable(mapper.findByComputeAttemptId(taskId, attemptId))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public java.util.List<GenerationJob> findJobsDueForReconciliation(
      java.time.Instant now, int limit) {
    java.util.List<GenerationJobRow> rows = mapper.findJobsDueForReconciliation(now, limit);
    return rows == null
        ? java.util.List.of()
        : rows.stream().map(MyBatisGenerationJobPersistenceAdapter::toDomain).toList();
  }

  @Override
  public Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey) {
    return Optional.ofNullable(mapper.findByIdempotencyKey(idempotencyKey))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<GenerationJob> findLatestByIdempotencyFamily(String baseIdempotencyKey) {
    return Optional.ofNullable(mapper.findLatestByIdempotencyFamily(baseIdempotencyKey))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public void acquireIdempotencyLock(String idempotencyKey) {
    mapper.acquireIdempotencyLock(idempotencyKey);
  }

  @Override
  public void acquireImageCapacityLock() {
    mapper.acquireImageCapacityLock();
  }

  @Override
  public void acquireAnalysisCapacityLock() {
    mapper.acquireAnalysisCapacityLock();
  }

  @Override
  public int countActiveImageJobs() {
    return mapper.countActiveImageJobs();
  }

  @Override
  public int countActiveJobs() {
    return mapper.countActiveJobs();
  }

  @Override
  public int countActiveVideoExecutions() {
    return mapper.countActiveVideoExecutions();
  }

  @Override
  public java.util.List<GenerationJob> findActiveChapterVideoBatches(int limit) {
    return mapper.findActiveChapterVideoBatches(limit).stream()
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain)
        .toList();
  }

  private GenerationJob requireInserted(UUID id) {
    GenerationJobRow inserted = mapper.findById(id);
    if (inserted == null)
      throw new IllegalStateException("Inserted generation job " + id + " disappeared");
    return toDomain(inserted);
  }

  private static GenerationJobRow toRow(GenerationJob job) {
    return new GenerationJobRow(
        job.getId(),
        job.getRowVersion(),
        null,
        null,
        job.getJobId(),
        job.getProjectId(),
        job.getType(),
        job.getStatus(),
        job.getResourceClass(),
        job.getProgress(),
        job.getCurrentStep(),
        job.getErrorCode(),
        job.getStoryVersionId(),
        job.getChapterId(),
        job.getChapterRowVersion(),
        job.getSourceHash(),
        job.getSourceText(),
        job.getSourceLanguage(),
        job.getIdempotencyKey(),
        job.getStoryboardRevisionId(),
        job.getMediaPlanId(),
        job.getMediaPlanRevision(),
        job.getProductionMode(),
        job.getAnalysisVisualGenerationMode(),
        job.getAnalysisImageProvider(),
        job.getSubmissionState(),
        job.getComputeAttemptId(),
        job.getComputeExecutionHandle(),
        job.getComputeSequence(),
        job.getLastComputeState(),
        job.getSubmittedAt(),
        job.getStartedAt(),
        job.getCompletedAt(),
        job.getLastReconciledAt(),
        job.getNextReconcileAt(),
        job.getReconcileAttemptCount(),
        job.getLastEventId(),
        job.getLastEventSequence(),
        job.getCallbackReceivedAt());
  }

  private static GenerationJob toDomain(GenerationJobRow row) {
    return GenerationJob.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getJobId(),
        row.getProjectId(),
        row.getType(),
        row.getStatus(),
        row.getResourceClass(),
        row.getProgress(),
        row.getCurrentStep(),
        row.getErrorCode(),
        row.getStoryVersionId(),
        row.getChapterId(),
        row.getStoryboardRevisionId(),
        row.getChapterRowVersion(),
        row.getSourceHash(),
        row.getSourceText(),
        row.getSourceLanguage(),
        row.getIdempotencyKey(),
        row.getMediaPlanId(),
        row.getMediaPlanRevision(),
        row.getProductionMode(),
        row.getAnalysisVisualGenerationMode(),
        row.getAnalysisImageProvider(),
        row.getSubmissionState(),
        row.getComputeAttemptId(),
        row.getComputeExecutionHandle(),
        row.getComputeSequence(),
        row.getLastComputeState(),
        row.getSubmittedAt(),
        row.getStartedAt(),
        row.getCompletedAt(),
        row.getLastReconciledAt(),
        row.getNextReconcileAt(),
        row.getReconcileAttemptCount(),
        row.getLastEventId(),
        row.getLastEventSequence(),
        row.getCallbackReceivedAt());
  }

  private static ResourceNotFoundException missing(UUID id) {
    return new ResourceNotFoundException(
        "GenerationJob " + id + " no longer exists while applying an update");
  }

  private static OptimisticLockingFailureException optimisticConflict(UUID id) {
    return new OptimisticLockingFailureException(
        "Generation job " + id + " was modified concurrently");
  }
}
