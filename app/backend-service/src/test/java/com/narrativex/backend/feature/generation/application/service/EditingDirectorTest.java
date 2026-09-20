package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EditingDirectorTest {

  private EditingDirector director;

  @BeforeEach
  void setUp() {
    director = new EditingDirector();
  }

  @Test
  void assembleEditDecisionList_buildsSequentialTimelineWithTrimming() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID audioAssetId = UUID.randomUUID();

    UUID shot1 = UUID.randomUUID();
    UUID take1 = UUID.randomUUID();
    UUID asset1 = UUID.randomUUID();

    UUID shot2 = UUID.randomUUID();
    UUID take2 = UUID.randomUUID();
    UUID asset2 = UUID.randomUUID();

    // Take 1: Generated 5000ms, trimmed from 500ms to 3500ms (edit duration = 3000ms)
    var cut1 = new EditingDirector.SelectedTakeCut(shot1, take1, asset1, 500L, 3500L, "CUT", 0L);

    // Take 2: Generated 6000ms, trimmed from 1000ms to 5000ms (edit duration = 4000ms)
    var cut2 = new EditingDirector.SelectedTakeCut(shot2, take2, asset2, 1000L, 5000L, "DISSOLVE", 500L);

    var edl =
        director.assembleEditDecisionList(
            projectId, null, chapterId, audioAssetId, 7000L, List.of(cut1, cut2));

    assertThat(edl.schemaVersion()).isEqualTo("1.0");
    assertThat(edl.fps()).isEqualTo(24);
    assertThat(edl.width()).isEqualTo(1280);
    assertThat(edl.height()).isEqualTo(720);
    assertThat(edl.audioClockSource()).isEqualTo("VIENEU_MASTER");
    assertThat(edl.totalDurationMs()).isEqualTo(7000L);
    assertThat(edl.decisions()).hasSize(2);

    var d1 = edl.decisions().get(0);
    assertThat(d1.shotId()).isEqualTo(shot1);
    assertThat(d1.sourceInMs()).isEqualTo(500L);
    assertThat(d1.sourceOutMs()).isEqualTo(3500L);
    assertThat(d1.timelineInMs()).isEqualTo(0L);
    assertThat(d1.timelineOutMs()).isEqualTo(3000L);

    var d2 = edl.decisions().get(1);
    assertThat(d2.shotId()).isEqualTo(shot2);
    assertThat(d2.sourceInMs()).isEqualTo(1000L);
    assertThat(d2.sourceOutMs()).isEqualTo(5000L);
    assertThat(d2.timelineInMs()).isEqualTo(3000L);
    assertThat(d2.timelineOutMs()).isEqualTo(7000L);
    assertThat(d2.transitionType()).isEqualTo("DISSOLVE");
  }

  @Test
  void selectedTakeCut_rejectsInvalidInOutPoints() {
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();

    assertThatThrownBy(
            () -> new EditingDirector.SelectedTakeCut(shotId, takeId, assetId, 3000L, 2000L, "CUT", 0L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("strictly greater than");
  }
}
