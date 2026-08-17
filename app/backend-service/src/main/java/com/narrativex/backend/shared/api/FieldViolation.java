package com.narrativex.backend.shared.api;

public record FieldViolation(String field, String code, String messageKey, String message) {
}
