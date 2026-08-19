package com.narrativex.backend.feature.storyboard.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateVisualBeatRequest(
    @NotBlank @Size(max = 200) String title, @NotBlank @Size(max = 8000) String visualIntent) {}
