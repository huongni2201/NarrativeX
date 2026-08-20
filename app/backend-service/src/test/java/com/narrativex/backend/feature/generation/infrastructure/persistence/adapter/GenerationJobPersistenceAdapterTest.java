package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.GenerationJobJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.GenerationJobJpaRepository;
import jakarta.persistence.EntityManager;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class GenerationJobPersistenceAdapterTest {
  @Mock private GenerationJobJpaRepository repository;
  @Mock private EntityManager entityManager;

  @Test
  void createsNewJobWhenDomainIdIsMissing() {
    GenerationJob job = job(null, 0L);
    when(repository.save(any(GenerationJobJpaEntity.class)))
        .thenAnswer(
            invocation -> {
              GenerationJobJpaEntity entity = invocation.getArgument(0);
              entity.setId(11L);
              return entity;
            });
    GenerationJobPersistenceAdapter adapter =
        new GenerationJobPersistenceAdapter(repository, entityManager);

    adapter.save(job);

    verify(repository, never()).findById(any());
    verify(repository).save(any(GenerationJobJpaEntity.class));
  }

  @Test
  void updatesExistingJobWithMatchingRowVersion() {
    GenerationJob job = job(11L, 3L);
    GenerationJobJpaEntity persisted = persistedJob(11L, 3L);
    when(repository.findById(11L)).thenReturn(Optional.of(persisted));
    when(repository.save(persisted)).thenReturn(persisted);
    GenerationJobPersistenceAdapter adapter =
        new GenerationJobPersistenceAdapter(repository, entityManager);

    adapter.save(job);

    verify(repository).save(persisted);
  }

  @Test
  void rejectsUpdateWhenPersistedJobIsMissing() {
    GenerationJob job = job(11L, 3L);
    when(repository.findById(11L)).thenReturn(Optional.empty());
    GenerationJobPersistenceAdapter adapter =
        new GenerationJobPersistenceAdapter(repository, entityManager);

    assertThrows(ResourceNotFoundException.class, () -> adapter.save(job));

    verify(repository, never()).save(any(GenerationJobJpaEntity.class));
  }

  @Test
  void rejectsUpdateWhenRowVersionIsStale() {
    GenerationJob job = job(11L, 3L);
    GenerationJobJpaEntity persisted = persistedJob(11L, 4L);
    when(repository.findById(11L)).thenReturn(Optional.of(persisted));
    GenerationJobPersistenceAdapter adapter =
        new GenerationJobPersistenceAdapter(repository, entityManager);

    assertThrows(ObjectOptimisticLockingFailureException.class, () -> adapter.save(job));

    verify(repository, never()).save(any(GenerationJobJpaEntity.class));
  }

  private static GenerationJob job(Long id, long rowVersion) {
    return GenerationJob.rehydrate(
        id,
        rowVersion,
        "job-11",
        7L,
        JobType.CHAPTER_ANALYZE,
        JobStatus.QUEUED,
        ResourceClass.PROVIDER_INTERACTIVE,
        0,
        "QUEUED",
        null,
        "user-1",
        "user-1",
        8L,
        9L,
        10L,
        2L,
        "hash",
        "source",
        "vi-VN",
        "idempotency-key");
  }

  private static GenerationJobJpaEntity persistedJob(Long id, long rowVersion) {
    GenerationJobJpaEntity entity =
        GenerationJobJpaEntity.builder()
            .jobId("job-11")
            .projectId(7L)
            .type(JobType.CHAPTER_ANALYZE)
            .status(JobStatus.QUEUED)
            .resourceClass(ResourceClass.PROVIDER_INTERACTIVE)
            .progress(0)
            .currentStep("QUEUED")
            .requestedByUserId("user-1")
            .billedToUserId("user-1")
            .storyVersionId(8L)
            .chapterId(9L)
            .storyboardRevisionId(10L)
            .chapterRowVersion(2L)
            .sourceHash("hash")
            .sourceText("source")
            .sourceLanguage("vi-VN")
            .idempotencyKey("idempotency-key")
            .build();
    entity.setId(id);
    entity.setRowVersion(rowVersion);
    return entity;
  }
}
