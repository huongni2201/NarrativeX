package com.narrativex.backend.feature.project.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class ArchivedProjectException extends DomainConflictException {
    public ArchivedProjectException() {
        super("Archived projects cannot receive story versions");
    }
}
