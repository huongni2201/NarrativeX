package com.narrativex.backend.feature.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    boolean success,
    int status,
    String code,
    String message,
    String path,
    String correlationId,
    List<FieldViolation> errors,
    Instant timestamp
) {
    public static ErrorResponse of(int status, String code, String message, String path, String correlationId) {
        return new ErrorResponse(false, status, code, message, path, correlationId, null, Instant.now());
    }

    public static ErrorResponse validation(int status, String code, String message, String path,
            String correlationId, List<FieldViolation> errors) {
        return new ErrorResponse(false, status, code, message, path, correlationId, errors, Instant.now());
    }
}
