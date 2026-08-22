package com.narrativex.backend.feature.storyboard.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ImportChapterContentRequest(
    @NotBlank @Size(max = 500_000) String content,
    @Size(max = 200) String title) {}
