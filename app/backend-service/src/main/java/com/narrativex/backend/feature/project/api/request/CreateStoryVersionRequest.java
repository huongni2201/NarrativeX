package com.narrativex.backend.feature.project.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStoryVersionRequest(
    @NotBlank String content,
    @Size(max = 16) String sourceLanguage) {}
