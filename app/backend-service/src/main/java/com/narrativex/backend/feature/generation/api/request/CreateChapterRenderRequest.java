package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateChapterRenderRequest(
    @NotBlank @Pattern(regexp = "720p|1080p") String resolution,
    @NotBlank @Pattern(regexp = "mp4") String format,
    UUID mediaPlanId,
    Integer mediaPlanRevision,
    BigDecimal maxAuthorizedCost) {
  public CreateChapterRenderRequest(String resolution, String format) {
    this(resolution, format, null, null, null);
  }
}
