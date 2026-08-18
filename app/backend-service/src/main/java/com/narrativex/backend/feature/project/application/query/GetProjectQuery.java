package com.narrativex.backend.feature.project.application.query;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;

public record GetProjectQuery(Long projectId) {
  public GetProjectQuery {
    if (projectId == null || projectId <= 0)
      throw new DomainValidationException("projectId must be positive");
  }
}
