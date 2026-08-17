package com.narrativex.backend.feature.character.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class InvalidCharacterVersionTransitionException extends DomainConflictException {
    public InvalidCharacterVersionTransitionException(String message) {
        super(message);
    }
}
