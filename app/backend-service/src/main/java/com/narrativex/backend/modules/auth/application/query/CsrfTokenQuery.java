package com.narrativex.backend.modules.auth.application.query;

public record CsrfTokenQuery(String token, String headerName) {
}
