package com.narrativex.backend.feature.project.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class ProjectPersistenceRequiredException extends DomainConflictException {
  public ProjectPersistenceRequiredException() {
    super("Project must be persisted before creating a story version");
  }
}
