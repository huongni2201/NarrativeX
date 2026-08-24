package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record CreateProjectRenderRequest(
    @NotBlank @Pattern(regexp = "720p|1080p") String resolution,
    @NotBlank @Pattern(regexp = "mp4") String format,
    BigDecimal maxAuthorizedCost) {}
