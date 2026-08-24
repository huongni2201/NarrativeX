package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateChapterRenderRequest(
    @NotBlank @Pattern(regexp = "720p|1080p") String resolution,
    @NotBlank @Pattern(regexp = "mp4") String format,
    @NotNull UUID mediaPlanId,
    @NotNull @Positive Integer mediaPlanRevision,
    BigDecimal maxAuthorizedCost,
    @Valid @Size(max = 500) List<BeatOverride> beatOverrides) {

  public CreateChapterRenderRequest {
    beatOverrides = beatOverrides == null ? List.of() : List.copyOf(beatOverrides);
  }

  public CreateChapterRenderRequest(
      String resolution,
      String format,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      BigDecimal maxAuthorizedCost) {
    this(resolution, format, mediaPlanId, mediaPlanRevision, maxAuthorizedCost, List.of());
  }

  public CreateChapterRenderRequest(String resolution, String format) {
    this(resolution, format, null, null, null, List.of());
  }

  public record BeatOverride(
      @NotNull UUID visualBeatId,
      @Min(1000) @Max(120000) Long durationMs,
      @Pattern(regexp = "NONE|PAN|TILT|PUSH_IN|PULL_OUT|TRACK|ZOOM_IN|ZOOM_OUT|PARALLAX")
          String cameraMovement) {}
}
