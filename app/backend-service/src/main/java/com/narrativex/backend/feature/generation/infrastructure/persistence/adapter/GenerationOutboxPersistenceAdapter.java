package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GenerationOutboxPersistenceAdapter implements GenerationOutboxRepository {

  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;

  @Override
  public void enqueue(GenerationJob job) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("jobId", job.getJobId());
    payload.put("jobType", job.getType().name());
    payload.put("projectId", job.getProjectId());
    payload.put("storyVersionId", job.getStoryVersionId());
    payload.put("chapterId", job.getChapterId());
    payload.put("chapterRowVersion", job.getChapterRowVersion());
    payload.put("sourceHash", job.getSourceHash());

    final String payloadJson;
    try {
      payloadJson = objectMapper.writeValueAsString(payload);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Unable to serialize generation outbox payload", exception);
    }

    jdbcTemplate.update(
        """
        INSERT INTO outbox_events
          (aggregate_type, aggregate_id, event_type, event_key, payload_json, status)
        VALUES
          ('GENERATION_JOB', ?, 'GENERATION_JOB_QUEUED', ?, CAST(? AS jsonb), 'PENDING')
        ON CONFLICT (event_key) DO NOTHING
        """,
        job.getJobId(),
        "generation-job:" + job.getJobId() + ":queued",
        payloadJson);
  }
}
