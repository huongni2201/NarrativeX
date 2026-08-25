package com.narrativex.backend.feature.auth.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record DesktopGuestSessionRequest(
    @NotBlank
        @Pattern(
            regexp = "(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
        String deviceId,
    @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String secret) {}
