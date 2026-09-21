package com.narrativex.backend.feature.storyboard.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.application.port.in.ShotPlanSpec;
import com.narrativex.backend.feature.storyboard.domain.entity.Shot;
import com.narrativex.backend.feature.storyboard.domain.entity.ShotSequence;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ShotDirectorTest {

  private ShotDirector shotDirector;

  @BeforeEach
  void setUp() {
    shotDirector = new ShotDirector();
  }

  @Test
  void validateTemporalProgression_throwsWhenStatesIdenticalWithoutStaticHold() {
    var spec =
        new ShotPlanSpec(
            0,
            "Contemplation",
            RetentionRole.COOLDOWN,
            List.of("hero"),
            "dungeon",
            "Sitting on stone floor",
            "None",
            "sitting on stone floor",
            "Medium close-up",
            "Eye-level 50mm",
            "Still",
            "Static",
            "Dust motes",
            4000L,
            null,
            false);

    assertThatThrownBy(() -> shotDirector.validateTemporalProgression(spec))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Temporal progression violation");
  }

  @Test
  void validateTemporalProgression_allowsIdenticalStatesWhenFlaggedAsIntentionalStaticHold() {
    var spec =
        new ShotPlanSpec(
            0,
            "Deliberate pause",
            RetentionRole.COOLDOWN,
            List.of("hero"),
            "dungeon",
            "Sitting on stone floor",
            "Staring ahead motionless",
            "Sitting on stone floor",
            "Medium close-up",
            "Eye-level 50mm",
            "Frozen",
            "Static",
            "Dust motes",
            3000L,
            null,
            true);

    // Should not throw
    shotDirector.validateTemporalProgression(spec);
  }

  @Test
  void validateTemporalProgression_allowsValidTemporalProgression() {
    var spec =
        new ShotPlanSpec(
            0,
            "Standing up",
            RetentionRole.ESCALATION,
            List.of("hero"),
            "dungeon",
            "Sitting on stone floor",
            "Stands up abruptly and grabs sword",
            "Standing upright facing door with sword drawn",
            "Wide shot",
            "Low angle 35mm",
            "Fast rise",
            "Slow tilt up",
            "Flickering torch",
            3500L,
            null);

    // Should not throw
    shotDirector.validateTemporalProgression(spec);
  }

  @Test
  void recommendGenerationStrategy_resolvesI2VWhenCharactersPresent() {
    var spec =
        new ShotPlanSpec(
            0,
            "Hero dialogue",
            RetentionRole.HOOK,
            List.of("elena"),
            "castle",
            "Looking left",
            "Speaks",
            "Looking forward",
            "Close-up",
            "50mm",
            "Subtle lips",
            "Static",
            "None",
            3000L,
            null);

    GenerationStrategy strategy = shotDirector.recommendGenerationStrategy(spec);
    assertThat(strategy).isEqualTo(GenerationStrategy.IMAGE_TO_VIDEO);
  }

  @Test
  void recommendGenerationStrategy_resolvesT2VWhenNoCharactersPresent() {
    var spec =
        new ShotPlanSpec(
            0,
            "Establishing landscape",
            RetentionRole.HOOK,
            List.of(),
            "mountain_range",
            "Sun behind mountain",
            "Sun rises over peak",
            "Sun illuminating valley",
            "Extreme wide",
            "Drone 24mm",
            "None",
            "Forward sweep",
            "Wind sweeping clouds",
            5000L,
            null);

    GenerationStrategy strategy = shotDirector.recommendGenerationStrategy(spec);
    assertThat(strategy).isEqualTo(GenerationStrategy.TEXT_TO_VIDEO);
  }

  @Test
  void recommendGenerationStrategy_preservesExplicitStrategy() {
    var spec =
        new ShotPlanSpec(
            0,
            "Spatial reveal",
            RetentionRole.CLIMAX,
            List.of("elena"),
            "throne_room",
            "Framed at doorway",
            "Camera tracks past her to throne",
            "Elena out of frame, crown resting on empty throne",
            "Tracking shot",
            "Dolly 35mm",
            "Still",
            "Dolly forward",
            "Fog rolling",
            4500L,
            GenerationStrategy.FIRST_LAST_FRAME);

    GenerationStrategy strategy = shotDirector.recommendGenerationStrategy(spec);
    assertThat(strategy).isEqualTo(GenerationStrategy.FIRST_LAST_FRAME);
  }

  @Test
  void planShotSequence_buildsSequenceWithShots() {
    UUID visualBeatId = UUID.randomUUID();
    var spec1 =
        new ShotPlanSpec(
            0,
            "Establishing shot",
            RetentionRole.HOOK,
            List.of(),
            "courtyard",
            "Empty courtyard at night",
            "Guards patrol across",
            "Guards exit through gate",
            "Wide",
            "24mm",
            "Walking",
            "Static",
            "Rain",
            4000L,
            null);
    var spec2 =
        new ShotPlanSpec(
            1,
            "Infiltration",
            RetentionRole.ESCALATION,
            List.of("thief"),
            "courtyard",
            "Rooftop edge",
            "Thief drops down to courtyard floor",
            "Crouched in shadow near gate",
            "Medium shot",
            "High angle 35mm",
            "Leaping drop",
            "Tilt down tracking drop",
            "Rain",
            3000L,
            null);

    ShotSequence sequence = shotDirector.planShotSequence(visualBeatId, 0, List.of(spec1, spec2));

    assertThat(sequence).isNotNull();
    assertThat(sequence.getVisualBeatId()).isEqualTo(visualBeatId);
    assertThat(sequence.getShots()).hasSize(2);

    Shot shot1 = sequence.getShots().get(0);
    assertThat(shot1.getOrderIndex()).isEqualTo(0);
    assertThat(shot1.getGenerationStrategy()).isEqualTo(GenerationStrategy.TEXT_TO_VIDEO);
    assertThat(shot1.getStatus()).isEqualTo(ShotStatus.PLANNED);

    Shot shot2 = sequence.getShots().get(1);
    assertThat(shot2.getOrderIndex()).isEqualTo(1);
    assertThat(shot2.getGenerationStrategy()).isEqualTo(GenerationStrategy.IMAGE_TO_VIDEO);
    assertThat(shot2.getSubjectsJson()).contains("thief");
    assertThat(shot2.getStatus()).isEqualTo(ShotStatus.PLANNED);
  }
}
