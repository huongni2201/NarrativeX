package com.narrativex.backend.feature.common.domain.exception;

public class DomainConflictException extends DomainException {
    public DomainConflictException(String message) {
        super(message);
    }

    public DomainConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
