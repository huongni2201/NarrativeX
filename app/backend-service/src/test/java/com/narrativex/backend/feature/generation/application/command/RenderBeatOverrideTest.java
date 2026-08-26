package com.narrativex.backend.feature.generation.application.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class RenderBeatOverrideTest {

  @Test
  void acceptsAutoEditFitAndTrimWithoutManualTimingOverride() {
    UUID beatId = UUID.randomUUID();

    RenderBeatOverride override =
        new RenderBeatOverride(beatId, null, null, " trim ", 1_250L);

    assertThat(override.visualBeatId()).isEqualTo(beatId);
    assertThat(override.fitMode()).isEqualTo("TRIM");
    assertThat(override.trimStartMs()).isEqualTo(1_250L);
  }

  @Test
  void preservesLegacyDurationAndCameraConstructor() {
    UUID beatId = UUID.randomUUID();

    RenderBeatOverride override = new RenderBeatOverride(beatId, 4_000L, " pan ");

    assertThat(override.durationMs()).isEqualTo(4_000L);
    assertThat(override.cameraMovement()).isEqualTo("PAN");
    assertThat(override.fitMode()).isNull();
    assertThat(override.trimStartMs()).isNull();
  }

  @Test
  void rejectsInvalidFitAndTrim() {
    UUID beatId = UUID.randomUUID();

    assertThatThrownBy(() -> new RenderBeatOverride(beatId, null, null, "STRETCH", 0L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported fit mode");
    assertThatThrownBy(() -> new RenderBeatOverride(beatId, null, null, "TRIM", -1L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("trimStartMs");
  }
}
