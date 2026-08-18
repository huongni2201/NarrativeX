package com.narrativex.backend.feature.character.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class ArchivedCharacterException extends DomainConflictException {
  public ArchivedCharacterException() {
    super("Archived characters cannot receive new versions");
  }
}
