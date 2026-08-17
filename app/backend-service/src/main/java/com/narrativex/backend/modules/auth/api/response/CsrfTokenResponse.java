package com.narrativex.backend.modules.auth.api.response;

public record CsrfTokenResponse(String token, String headerName) {
}
