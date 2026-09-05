package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationJobMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationJobRow;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisGenerationJobPersistenceAdapter implements GenerationJobRepository {
  private final GenerationJobMapper mapper;

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
    return toDomain(updated);
  }

  @Override
  public Optional<GenerationJob> findByIdAndOwner(UUID id, String ownerId) {
    return Optional.ofNullable(mapper.findByIdAndOwner(id, ownerId))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<GenerationJob> findByJobIdAndOwner(UUID jobId, String ownerId) {
    return Optional.ofNullable(mapper.findByJobIdAndOwner(jobId, ownerId))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey, String ownerId) {
    return Optional.ofNullable(mapper.findByIdempotencyKey(idempotencyKey, ownerId))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<GenerationJob> findLatestByIdempotencyFamily(
      String baseIdempotencyKey, String ownerId) {
    return Optional.ofNullable(mapper.findLatestByIdempotencyFamily(baseIdempotencyKey, ownerId))
        .map(MyBatisGenerationJobPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<String> findRequestFingerprint(UUID id) {
    return Optional.ofNullable(mapper.findRequestFingerprint(id));
  }

  @Override
  public void setRequestFingerprint(UUID id, String requestFingerprint) {
    if (mapper.setRequestFingerprint(id, requestFingerprint) != 1) throw missing(id);
  }

  @Override
  public void acquireIdempotencyLock(String idempotencyKey, String ownerId) {
    mapper.acquireIdempotencyLock(idempotencyKey, ownerId);
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
        job.getRequestedByUserId(),
        job.getBilledToUserId(),
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
        job.getAnalysisImageProvider());
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
        row.getRequestedByUserId(),
        row.getBilledToUserId(),
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
        row.getAnalysisImageProvider());
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
