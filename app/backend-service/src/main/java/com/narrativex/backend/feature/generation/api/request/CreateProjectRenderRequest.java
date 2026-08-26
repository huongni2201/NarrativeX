package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateProjectRenderRequest(
    @NotBlank @Pattern(regexp = "720p|1080p") String resolution,
    @NotBlank @Pattern(regexp = "mp4") String format,
    BigDecimal maxAuthorizedCost,
    @Pattern(regexp = "CLOUD|LOCAL_DEVICE") String executionTarget,
    UUID localDeviceId,
    UUID backgroundMusicAssetId,
    @Valid @Size(max = 2000) List<BeatOverride> beatOverrides) {

  public CreateProjectRenderRequest {
    executionTarget =
        executionTarget == null || executionTarget.isBlank()
            ? "CLOUD"
            : executionTarget.trim().toUpperCase(java.util.Locale.ROOT);
    beatOverrides = beatOverrides == null ? List.of() : List.copyOf(beatOverrides);
  }

  public CreateProjectRenderRequest(
      String resolution, String format, BigDecimal maxAuthorizedCost) {
    this(resolution, format, maxAuthorizedCost, "CLOUD", null, null, List.of());
  }

  public CreateProjectRenderRequest(
      String resolution,
      String format,
      BigDecimal maxAuthorizedCost,
      List<BeatOverride> beatOverrides) {
    this(resolution, format, maxAuthorizedCost, "CLOUD", null, null, beatOverrides);
  }

  public record BeatOverride(
      @NotNull UUID visualBeatId,
      @Min(1000) @Max(120000) Long durationMs,
      @Pattern(regexp = "NONE|PAN|TILT|PUSH_IN|PULL_OUT|TRACK|ZOOM_IN|ZOOM_OUT|PARALLAX")
          String cameraMovement,
      @Pattern(regexp = "TRIM|LOOP|FREEZE_END|SPEED_ADJUST") String fitMode,
      @Min(0) Long trimStartMs) {
    public BeatOverride(UUID visualBeatId, Long durationMs, String cameraMovement) {
      this(visualBeatId, durationMs, cameraMovement, null, null);
    }
  }
}
