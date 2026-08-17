package com.narrativex.backend.modules.auth.application.response;

public record CsrfTokenResponse(String token, String headerName) {
}
