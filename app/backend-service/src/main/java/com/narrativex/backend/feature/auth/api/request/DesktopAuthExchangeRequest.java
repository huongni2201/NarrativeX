package com.narrativex.backend.feature.auth.api.request;

import jakarta.validation.constraints.NotBlank;

public record DesktopAuthExchangeRequest(@NotBlank String code) {}
