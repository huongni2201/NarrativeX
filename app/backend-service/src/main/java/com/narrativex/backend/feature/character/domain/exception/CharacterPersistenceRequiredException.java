package com.narrativex.backend.feature.character.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class CharacterPersistenceRequiredException extends DomainConflictException {
    public CharacterPersistenceRequiredException() {
        super("Character must be persisted before creating a version");
    }
}
