package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GenerationOutboxPersistenceAdapter implements GenerationOutboxRepository {

  private final JdbcTemplate jdbcTemplate;

  @Override
  public void enqueue(GenerationJob job) {
    jdbcTemplate.update(
        """
        INSERT INTO outbox_events
          (aggregate_type, aggregate_id, event_type, event_key, payload_json, status)
        VALUES
          (
            'GENERATION_JOB',
            ?,
            'GENERATION_JOB_QUEUED',
            ?,
            jsonb_build_object(
              'jobId', ?,
              'jobType', ?,
              'projectId', ?,
              'storyVersionId', ?,
              'chapterId', ?,
              'chapterRowVersion', ?,
              'sourceHash', ?
            ),
            'PENDING'
          )
        ON CONFLICT (event_key) DO NOTHING
        """,
        job.getJobId(),
        "generation-job:" + job.getJobId() + ":queued",
        job.getJobId(),
        job.getType().name(),
        job.getProjectId(),
        job.getStoryVersionId(),
        job.getChapterId(),
        job.getChapterRowVersion(),
        job.getSourceHash());
  }
}
