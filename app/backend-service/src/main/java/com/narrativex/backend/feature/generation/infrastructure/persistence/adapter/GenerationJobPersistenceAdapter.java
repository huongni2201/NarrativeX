package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.GenerationJobJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mapper.GenerationPersistenceMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.GenerationJobJpaRepository;
import jakarta.persistence.EntityManager;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GenerationJobPersistenceAdapter implements GenerationJobRepository {

  private final GenerationJobJpaRepository repository;
  private final EntityManager entityManager;

  @Override
  public GenerationJob save(GenerationJob job) {
    GenerationJobJpaEntity entity =
        job.getId() == null
            ? buildJpaEntity(job)
            : repository
                .findById(job.getId())
                .map(
                    existing -> {
                      OptimisticConcurrency.requireVersion(
                          job.getRowVersion(),
                          existing.getRowVersion(),
                          GenerationJobJpaEntity.class,
                          job.getId());
                      existing.apply(job);
                      return existing;
                    })
                .orElseGet(() -> buildJpaEntity(job));
    return GenerationPersistenceMapper.toDomain(repository.save(entity));
  }

  private static GenerationJobJpaEntity buildJpaEntity(GenerationJob job) {
    return GenerationJobJpaEntity.builder()
        .jobId(job.getJobId())
        .projectId(job.getProjectId())
        .type(job.getType())
        .status(job.getStatus())
        .resourceClass(job.getResourceClass())
        .progress(job.getProgress())
        .currentStep(job.getCurrentStep())
        .errorCode(job.getErrorCode())
        .requestedByUserId(job.getRequestedByUserId())
        .billedToUserId(job.getBilledToUserId())
        .storyVersionId(job.getStoryVersionId())
        .chapterId(job.getChapterId())
        .storyboardRevisionId(job.getStoryboardRevisionId())
        .chapterRowVersion(job.getChapterRowVersion())
        .sourceHash(job.getSourceHash())
        .sourceText(job.getSourceText())
        .sourceLanguage(job.getSourceLanguage())
        .idempotencyKey(job.getIdempotencyKey())
        .mediaPlanId(job.getMediaPlanId())
        .mediaPlanRevision(job.getMediaPlanRevision())
        .productionMode(job.getProductionMode())
        .build();
  }

  @Override
  public Optional<GenerationJob> findByJobIdAndOwner(String jobId, String ownerId) {
    return repository
        .findByJobIdAndOwner(jobId, ownerId)
        .map(GenerationPersistenceMapper::toDomain);
  }

  @Override
  public Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey) {
    return repository
        .findByIdempotencyKey(idempotencyKey)
        .map(GenerationPersistenceMapper::toDomain);
  }

  @Override
  public void acquireIdempotencyLock(String idempotencyKey) {
    entityManager
        .createNativeQuery(
            "SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(:idempotencyKey, 0))")
        .setParameter("idempotencyKey", idempotencyKey)
        .getSingleResult();
  }
}
