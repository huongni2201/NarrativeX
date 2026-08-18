package com.narrativex.backend.feature.storyboard.api.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateChapterRequest(
    @NotNull @Size(min = 1, max = 200) String title, @NotNull String sourceText) {}
