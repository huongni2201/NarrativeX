package com.narrativex.backend.modules.common.api;

public record FieldViolation(String field, String code, String messageKey, String message) {
}
