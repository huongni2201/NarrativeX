package com.narrativex.backend.feature.project.application.query;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.util.UUID;

public record GetProjectQuery(UUID projectId) {
  public GetProjectQuery {
    if (projectId == null) throw new DomainValidationException("projectId must not be null");
  }
}
