package com.narrativex.backend.feature.auth.application.query;

public record CsrfTokenQuery(String token, String headerName) {
}
