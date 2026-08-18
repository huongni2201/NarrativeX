package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.StageAttemptJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.StageAttemptJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StageAttemptPersistenceAdapter implements StageAttemptRepository {

  private final StageAttemptJpaRepository repository;

  @Override
  public StageAttempt save(StageAttempt stageAttempt) {
    StageAttemptJpaEntity entity =
        StageAttemptJpaEntity.builder()
            .generationJobId(stageAttempt.getGenerationJobId())
            .stageName(stageAttempt.getStageName())
            .attemptNumber(stageAttempt.getAttemptNumber())
            .status(stageAttempt.getStatus())
            .workerId(stageAttempt.getWorkerId())
            .heartbeatAt(stageAttempt.getHeartbeatAt())
            .build();
    StageAttemptJpaEntity saved = repository.save(entity);
    return StageAttempt.rehydrate(
        saved.getId(),
        saved.getRowVersion(),
        saved.getGenerationJobId(),
        saved.getStageName(),
        saved.getAttemptNumber(),
        saved.getStatus(),
        saved.getWorkerId(),
        saved.getHeartbeatAt());
  }
}
