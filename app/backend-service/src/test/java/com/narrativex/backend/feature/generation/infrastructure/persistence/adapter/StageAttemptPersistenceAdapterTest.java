package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.StageAttemptJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.StageAttemptJpaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StageAttemptPersistenceAdapterTest {
  @Mock private StageAttemptJpaRepository repository;

  @Test
  void createsOnlyNewStageAttempts() {
    StageAttempt attempt = StageAttempt.create(7L, "CHAPTER_ANALYSIS", 1);
    when(repository.save(any(StageAttemptJpaEntity.class)))
        .thenAnswer(
            invocation -> {
              StageAttemptJpaEntity entity = invocation.getArgument(0);
              entity.setId(11L);
              return entity;
            });
    StageAttemptPersistenceAdapter adapter = new StageAttemptPersistenceAdapter(repository);

    adapter.create(attempt);

    verify(repository).save(any(StageAttemptJpaEntity.class));
  }

  @Test
  void rejectsStageAttemptWithExistingIdBeforeWriting() {
    StageAttempt attempt =
        StageAttempt.rehydrate(11L, 0L, 7L, "CHAPTER_ANALYSIS", 1, JobStatus.QUEUED, null, null);
    StageAttemptPersistenceAdapter adapter = new StageAttemptPersistenceAdapter(repository);

    assertThrows(IllegalArgumentException.class, () -> adapter.create(attempt));

    verify(repository, never()).save(any(StageAttemptJpaEntity.class));
  }
}
