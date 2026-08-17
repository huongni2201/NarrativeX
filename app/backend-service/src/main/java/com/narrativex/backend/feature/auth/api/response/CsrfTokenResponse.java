package com.narrativex.backend.feature.auth.api.response;

public record CsrfTokenResponse(String token, String headerName) {
}
