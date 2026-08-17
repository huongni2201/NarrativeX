package com.narrativex.backend.feature.project.application.query;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;

public record ProjectListQuery(String ownerId, String cursor, int limit) {
  public ProjectListQuery {
    if (limit < 1 || limit > 100) {
      throw new DomainValidationException("limit must be between 1 and 100");
    }
  }
}
