package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GenerationOutboxPersistenceAdapter implements GenerationOutboxRepository {

  private final GenerationOutboxMapper mapper;

  @Override
  public void enqueue(GenerationJob job) {
    mapper.enqueue(
        new GenerationOutboxRow(
            job.getJobId(),
            "generation-job:" + job.getJobId() + ":queued",
            job.getType(),
            job.getProjectId(),
            job.getStoryVersionId(),
            job.getChapterId(),
            job.getChapterRowVersion(),
            job.getSourceHash(),
            job.getMediaPlanId(),
            job.getMediaPlanRevision(),
            job.getProductionMode()));
  }
}
