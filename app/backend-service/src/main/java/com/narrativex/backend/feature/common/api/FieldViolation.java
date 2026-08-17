package com.narrativex.backend.feature.common.api;

public record FieldViolation(String field, String code, String messageKey, String message) {
}
