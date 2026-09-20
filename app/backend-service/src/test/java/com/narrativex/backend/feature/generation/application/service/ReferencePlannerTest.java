package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ReferenceType;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ReferencePlannerTest {

  private ReferencePlanner referencePlanner;

  @BeforeEach
  void setUp() {
    referencePlanner = new ReferencePlanner();
  }

  @Test
  void planReferences_textToVideoRequiresNoReferences() {
    ShotView shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Wide mountain range",
            RetentionRole.HOOK,
            "[]",
            "mountains",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    var result = referencePlanner.planReferences(shot, Map.of(), Map.of(), Map.of());
    assertThat(result.isReady()).isTrue();
    assertThat(result.references()).isEmpty();
    assertThat(result.missingReferenceRequirements()).isEmpty();
  }

  @Test
  void planReferences_imageToVideo_flagsMissingCharacterReference() {
    ShotView shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Hero dialogue",
            RetentionRole.HOOK,
            "[{\"aiName\":\"elena\"}]",
            "castle",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            3000L,
            GenerationStrategy.IMAGE_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    var result = referencePlanner.planReferences(shot, Map.of(), Map.of(), Map.of());
    assertThat(result.isReady()).isFalse();
    assertThat(result.missingReferenceRequirements())
        .contains("Missing approved CHARACTER_REFERENCE for required character: elena");
  }

  @Test
  void planReferences_imageToVideo_resolvesApprovedReferences() {
    UUID elenaAssetId = UUID.randomUUID();
    UUID castleAssetId = UUID.randomUUID();
    ShotView shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Hero dialogue",
            RetentionRole.HOOK,
            "[{\"aiName\":\"elena\"}]",
            "castle",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            3000L,
            GenerationStrategy.IMAGE_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    var result =
        referencePlanner.planReferences(
            shot,
            Map.of("elena", elenaAssetId),
            Map.of("castle", castleAssetId),
            Map.of());

    assertThat(result.isReady()).isTrue();
    assertThat(result.references()).hasSize(2);
    assertThat(result.references().get(0).getReferenceType())
        .isEqualTo(ReferenceType.CHARACTER_REFERENCE);
    assertThat(result.references().get(0).getMediaAssetId()).isEqualTo(elenaAssetId);
    assertThat(result.references().get(1).getReferenceType())
        .isEqualTo(ReferenceType.LOCATION_REFERENCE);
    assertThat(result.references().get(1).getMediaAssetId()).isEqualTo(castleAssetId);
  }

  @Test
  void planReferences_firstLastFrame_requiresBothKeyframes() {
    ShotView shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Tracking reveal",
            RetentionRole.CLIMAX,
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
            4000L,
            GenerationStrategy.FIRST_LAST_FRAME,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    var missingResult = referencePlanner.planReferences(shot, Map.of(), Map.of(), Map.of());
    assertThat(missingResult.isReady()).isFalse();
    assertThat(missingResult.missingReferenceRequirements()).hasSize(2);

    UUID startId = UUID.randomUUID();
    UUID endId = UUID.randomUUID();
    var okResult =
        referencePlanner.planReferences(
            shot, Map.of(), Map.of(), Map.of("start", startId, "end", endId));
    assertThat(okResult.isReady()).isTrue();
    assertThat(okResult.references()).hasSize(2);
  }
}
