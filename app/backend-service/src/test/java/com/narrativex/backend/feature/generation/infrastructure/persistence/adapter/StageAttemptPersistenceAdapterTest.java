package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StageAttemptMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StageAttemptRow;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StageAttemptPersistenceAdapterTest {
  private static final UUID STAGE_ATTEMPT_ID = UuidV7.random();
  private static final UUID JOB_ID = UuidV7.random();

  @Mock private StageAttemptMapper mapper;

  @Test
  void createsOnlyNewStageAttempts() {
    StageAttempt attempt = StageAttempt.create(JOB_ID, "CHAPTER_ANALYSIS", 1);
    when(mapper.insert(any(StageAttemptRow.class))).thenReturn(STAGE_ATTEMPT_ID);
    when(mapper.findById(STAGE_ATTEMPT_ID))
        .thenReturn(
            new StageAttemptRow(
                STAGE_ATTEMPT_ID, 0L, JOB_ID, "CHAPTER_ANALYSIS", 1, JobStatus.QUEUED, null, null));
    StageAttemptPersistenceAdapter adapter = new StageAttemptPersistenceAdapter(mapper);

    adapter.create(attempt);

    verify(mapper).insert(any(StageAttemptRow.class));
  }

  @Test
  void rejectsStageAttemptWithExistingIdBeforeWriting() {
    StageAttempt attempt =
        StageAttempt.rehydrate(
            STAGE_ATTEMPT_ID, 0L, JOB_ID, "CHAPTER_ANALYSIS", 1, JobStatus.QUEUED, null, null);
    StageAttemptPersistenceAdapter adapter = new StageAttemptPersistenceAdapter(mapper);

    assertThrows(IllegalArgumentException.class, () -> adapter.create(attempt));

    verify(mapper, never()).insert(any(StageAttemptRow.class));
  }
}
