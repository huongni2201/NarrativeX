package com.narrativex.backend.feature.character.application.query;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;

public record CharacterListQuery(String cursor, int limit) {
  public CharacterListQuery {
    if (limit < 1 || limit > 100) {
      throw new DomainValidationException("limit must be between 1 and 100");
    }
  }
}
