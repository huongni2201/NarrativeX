package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;

public interface StageAttemptRepository {
  StageAttempt create(StageAttempt stageAttempt);
}
