package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StageAttemptMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StageAttemptRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StageAttemptPersistenceAdapterTest {
  @Mock private StageAttemptMapper mapper;

  @Test
  void createsOnlyNewStageAttempts() {
    StageAttempt attempt = StageAttempt.create(7L, "CHAPTER_ANALYSIS", 1);
    when(mapper.insert(any(StageAttemptRow.class))).thenReturn(11L);
    when(mapper.findById(11L))
        .thenReturn(
            new StageAttemptRow(11L, 0L, 7L, "CHAPTER_ANALYSIS", 1, JobStatus.QUEUED, null, null));
    StageAttemptPersistenceAdapter adapter = new StageAttemptPersistenceAdapter(mapper);

    adapter.create(attempt);

    verify(mapper).insert(any(StageAttemptRow.class));
  }

  @Test
  void rejectsStageAttemptWithExistingIdBeforeWriting() {
    StageAttempt attempt =
        StageAttempt.rehydrate(11L, 0L, 7L, "CHAPTER_ANALYSIS", 1, JobStatus.QUEUED, null, null);
    StageAttemptPersistenceAdapter adapter = new StageAttemptPersistenceAdapter(mapper);

    assertThrows(IllegalArgumentException.class, () -> adapter.create(attempt));

    verify(mapper, never()).insert(any(StageAttemptRow.class));
  }
}
