package com.narrativex.backend.feature.auth.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record DesktopAuthExchangeRequest(
    @NotBlank String code,
    @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43,86}") String codeVerifier) {}
