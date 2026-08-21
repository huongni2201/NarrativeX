package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StageAttemptMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StageAttemptRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StageAttemptPersistenceAdapter implements StageAttemptRepository {

  private final StageAttemptMapper mapper;

  @Override
  public StageAttempt create(StageAttempt stageAttempt) {
    if (stageAttempt.getId() != null) {
      throw new IllegalArgumentException(
          "StageAttempt.create requires a new StageAttempt without an id");
    }
    Long id = mapper.insert(toRow(stageAttempt));
    if (id == null) {
      throw new IllegalStateException("Inserted stage attempt did not return an id");
    }
    StageAttemptRow saved = mapper.findById(id);
    if (saved == null) {
      throw new IllegalStateException("Inserted stage attempt " + id + " disappeared");
    }
    return toDomain(saved);
  }

  private static StageAttemptRow toRow(StageAttempt attempt) {
    return new StageAttemptRow(
        null,
        0L,
        attempt.getGenerationJobId(),
        attempt.getStageName(),
        attempt.getAttemptNumber(),
        attempt.getStatus(),
        attempt.getWorkerId(),
        attempt.getHeartbeatAt());
  }

  private static StageAttempt toDomain(StageAttemptRow row) {
    return StageAttempt.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getGenerationJobId(),
        row.getStageName(),
        row.getAttemptNumber(),
        row.getStatus(),
        row.getWorkerId(),
        row.getHeartbeatAt());
  }
}
