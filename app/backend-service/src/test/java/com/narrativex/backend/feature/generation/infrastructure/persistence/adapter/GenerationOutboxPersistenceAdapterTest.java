package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GenerationOutboxPersistenceAdapterTest {
  @Mock private GenerationOutboxMapper mapper;

  @Test
  void enqueuesAStableIdempotentEventKey() {
    GenerationJob job =
        GenerationJob.create(
            UuidV7.random(), JobType.STORY_ANALYZE, ResourceClass.CPU_LIGHT, "user-1");
    when(mapper.enqueue(any(GenerationOutboxRow.class))).thenReturn(1);

    new GenerationOutboxPersistenceAdapter(mapper).enqueue(job);

    verify(mapper)
        .enqueue(
            org.mockito.ArgumentMatchers.argThat(
                row ->
                    row.getAggregateId().equals(job.getJobId().toString())
                        && row.getEventKey().equals("generation-job:" + job.getJobId() + ":queued")
                        && row.getJobType() == JobType.STORY_ANALYZE));
  }
}
