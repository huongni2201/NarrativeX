package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.NarrationOperation;

public interface NarrationOperationRepository {
  NarrationOperation save(NarrationOperation operation);
}
