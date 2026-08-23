package com.narrativex.backend.feature.storyboard.api.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateChapterRequest(
    Long storyVersionId,
    @Min(0) Integer orderIndex,
    @NotNull @Size(min = 1, max = 200) String title,
    @NotNull String sourceText) {}
