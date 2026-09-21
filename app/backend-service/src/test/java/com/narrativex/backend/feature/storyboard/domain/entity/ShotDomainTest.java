package com.narrativex.backend.feature.storyboard.domain.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ShotDomainTest {

  @Test
  void shotSequenceHoldsOrderedShots() {
    UUID visualBeatId = UUID.randomUUID();
    UUID sequenceId = UUID.randomUUID();

    Shot shot1 =
        new Shot(
            sequenceId,
            0,
            "Establish mysterious corridor",
            RetentionRole.HOOK,
            "[\"Marcus\"]",
            "ancient_hall",
            "{\"actor\":\"standing\",\"expression\":\"tense\"}",
            "{\"movement\":\"walks forward slowly\"}",
            "{\"actor\":\"stops at heavy wooden door\"}",
            "{\"shot_size\":\"WIDE\",\"camera_angle\":\"EYE_LEVEL\"}",
            "{\"lens_mm\":35}",
            "{\"speed\":\"SLOW\",\"direction\":\"FORWARD\"}",
            "{\"camera_movement\":\"TRACK_IN\"}",
            "{\"torch_flicker\":\"SUBTLE\"}",
            3500L,
            GenerationStrategy.IMAGE_TO_VIDEO,
            "720p_24fps_cinematic",
            null,
            null,
            ShotStatus.PLANNED);

    Shot shot2 =
        new Shot(
            sequenceId,
            1,
            "Close-up of trembling hand on brass door handle",
            RetentionRole.ESCALATION,
            "[\"Marcus\"]",
            "ancient_hall",
            "{\"hand\":\"hovering over handle\"}",
            "{\"movement\":\"grips and turns handle\"}",
            "{\"handle\":\"turned, latch clicks open\"}",
            "{\"shot_size\":\"CLOSE_UP\",\"camera_angle\":\"DUTCH\"}",
            "{\"lens_mm\":85}",
            "{\"speed\":\"MEDIUM\"}",
            "{\"camera_movement\":\"PUSH_IN\"}",
            "{\"shadow\":\"deepens\"}",
            2500L,
            GenerationStrategy.IMAGE_TO_VIDEO,
            "720p_24fps_cinematic",
            shot1.getId(),
            null,
            ShotStatus.PLANNED);

    ShotSequence sequence = new ShotSequence(visualBeatId, 0, List.of(shot1, shot2));

    assertThat(sequence.getVisualBeatId()).isEqualTo(visualBeatId);
    assertThat(sequence.getShots()).hasSize(2);
    assertThat(sequence.getShots().get(0).getNarrativePurpose())
        .isEqualTo("Establish mysterious corridor");
    assertThat(sequence.getShots().get(1).getGenerationStrategy())
        .isEqualTo(GenerationStrategy.IMAGE_TO_VIDEO);
  }

  @Test
  void shotStateTransitionUpdatesStatus() {
    UUID sequenceId = UUID.randomUUID();
    Shot shot =
        new Shot(
            sequenceId,
            0,
            "B-roll misty mountains",
            RetentionRole.INCITING,
            "[]",
            "mountain_ridge",
            "{\"fog\":\"dense\"}",
            "{\"movement\":\"clouds roll over peaks\"}",
            "{\"fog\":\"partially clears\"}",
            "{\"shot_size\":\"EXTREME_WIDE\"}",
            "{\"lens_mm\":24}",
            "{}",
            "{\"camera_movement\":\"PAN_RIGHT\"}",
            "{\"wind\":\"STRONG\"}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    assertThat(shot.getStatus()).isEqualTo(ShotStatus.PLANNED);

    Shot readyShot = shot.withStatus(ShotStatus.READY);
    assertThat(readyShot.getStatus()).isEqualTo(ShotStatus.READY);

    Shot queuedShot = readyShot.withStatus(ShotStatus.QUEUED);
    assertThat(queuedShot.getStatus()).isEqualTo(ShotStatus.QUEUED);

    Shot validatingShot = queuedShot.withStatus(ShotStatus.VALIDATING);
    assertThat(validatingShot.getStatus()).isEqualTo(ShotStatus.VALIDATING);

    Shot passedShot = validatingShot.withStatus(ShotStatus.PASSED);
    assertThat(passedShot.getStatus()).isEqualTo(ShotStatus.PASSED);

    Shot selectedShot = passedShot.withStatus(ShotStatus.SELECTED);
    assertThat(selectedShot.getStatus()).isEqualTo(ShotStatus.SELECTED);
  }

  @Test
  void rejectsNegativeOrderIndex() {
    UUID sequenceId = UUID.randomUUID();
    assertThatThrownBy(
            () ->
                new Shot(
                    sequenceId,
                    -1,
                    "Invalid order",
                    RetentionRole.HOOK,
                    "[]",
                    null,
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    3000L,
                    GenerationStrategy.TEXT_TO_VIDEO,
                    "standard",
                    null,
                    null,
                    ShotStatus.PLANNED))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("orderIndex must not be negative");
  }
}
