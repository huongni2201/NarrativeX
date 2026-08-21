package com.narrativex.backend.feature.generation.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.application.service.NarrationFingerprintService;
import com.narrativex.backend.feature.generation.application.service.NarrationOperationPlanner;
import com.narrativex.backend.feature.generation.application.service.NarrationTimelineFactory;
import com.narrativex.backend.feature.generation.domain.enums.AlignmentStatus;
import com.narrativex.backend.feature.generation.domain.enums.NarrationStrategy;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocument;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocumentChapter;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationSpan;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NarrationPipelineContractTest {
  private static final UUID STORY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final String HASH_A = "a".repeat(64);
  private static final String HASH_B = "b".repeat(64);

  @Test
  void reorderingAudioChangesNarrationFingerprint() {
    NarrationFingerprintService service = new NarrationFingerprintService();
    var first = List.of(part(0, HASH_A, 1_000), part(1, HASH_B, 2_000));
    var reordered = List.of(part(0, HASH_B, 2_000), part(1, HASH_A, 1_000));

    assertThat(service.narrationFingerprint(first))
        .isNotEqualTo(service.narrationFingerprint(reordered));
  }

  @Test
  void changingChapterRevisionChangesDocumentFingerprint() {
    NarrationFingerprintService service = new NarrationFingerprintService();
    var first =
        List.of(chapter(0, UUID.fromString("00000000-0000-0000-0000-000000000010"), HASH_A, 0, 4));
    var edited =
        List.of(chapter(0, UUID.fromString("00000000-0000-0000-0000-000000000011"), HASH_A, 0, 4));

    assertThat(service.documentFingerprint(first))
        .isNotEqualTo(service.documentFingerprint(edited));
  }

  @Test
  void uploadedAudioPlanDoesNotContainTtsStage() {
    NarrationOperationPlanner planner = new NarrationOperationPlanner();

    assertThat(planner.plan(NarrationStrategy.USER_PROVIDED_AUDIO))
        .containsExactly(
            NarrationOperationPlanner.Stage.CHAPTER_ANALYZE,
            NarrationOperationPlanner.Stage.AUDIO_ALIGN,
            NarrationOperationPlanner.Stage.VISUAL_PLAN,
            NarrationOperationPlanner.Stage.IMAGE_GENERATE,
            NarrationOperationPlanner.Stage.MOTION,
            NarrationOperationPlanner.Stage.RENDER);
    assertThat(planner.includesTts(NarrationStrategy.USER_PROVIDED_AUDIO)).isFalse();
  }

  @Test
  void oneAudioPartCanCoverMultipleChapters() {
    var document = document();
    var part = part(0, HASH_A, 10_000);
    var timeline =
        new NarrationTimelineFactory()
            .create(
                document,
                UUID.fromString("00000000-0000-0000-0000-000000000020"),
                HASH_B,
                List.of(part),
                List.of(
                    span(document.chapters().get(0).chapterRevisionId(), 0, 4, 0, 4, 0, 4_000),
                    span(
                        document.chapters().get(1).chapterRevisionId(), 0, 4, 4, 8, 4_000, 10_000)),
                0.99,
                0.97,
                0.90);

    assertThat(timeline.status()).isEqualTo(AlignmentStatus.READY);
    assertThat(timeline.parts())
        .singleElement()
        .satisfies(
            p -> {
              assertThat(p.globalStartMs()).isZero();
              assertThat(p.globalEndMs()).isEqualTo(10_000);
            });
  }

  @Test
  void gapDoesNotFallbackToTts() {
    var document = document();
    var timeline =
        new NarrationTimelineFactory()
            .create(
                document,
                UUID.fromString("00000000-0000-0000-0000-000000000020"),
                HASH_B,
                List.of(part(0, HASH_A, 10_000)),
                List.of(span(document.chapters().get(0).chapterRevisionId(), 0, 4, 0, 4, 0, 4_000)),
                0.99,
                0.97,
                0.90);

    assertThat(timeline.status()).isEqualTo(AlignmentStatus.GAP_DETECTED);
  }

  @Test
  void pendingPartCannotBeUsedAsReadyMediaAsset() {
    var asset =
        new com.narrativex.backend.feature.generation.domain.value.MediaAsset(
            UUID.randomUUID(),
            com.narrativex.backend.feature.generation.domain.enums.MediaAssetType.AUDIO,
            com.narrativex.backend.feature.generation.domain.enums.MediaAssetOrigin.USER_UPLOAD,
            "media/audio/uploads/account/asset/original",
            "voice.mp3",
            "audio/mpeg",
            100,
            HASH_A,
            1_000L,
            com.narrativex.backend.feature.generation.domain.enums.MediaAssetStatus.VALIDATING,
            java.time.Instant.now());

    assertThatThrownBy(asset::requireReadyAudio)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("not READY");
  }

  private static NarrationDocument document() {
    return new NarrationDocument(
        UUID.fromString("00000000-0000-0000-0000-000000000030"),
        STORY_ID,
        HASH_A,
        List.of(
            chapter(0, UUID.fromString("00000000-0000-0000-0000-000000000010"), HASH_A, 0, 4),
            chapter(1, UUID.fromString("00000000-0000-0000-0000-000000000011"), HASH_B, 4, 8)));
  }

  private static NarrationDocumentChapter chapter(
      int sequence, UUID revisionId, String hash, int start, int end) {
    return new NarrationDocumentChapter(
        UUID.randomUUID(), revisionId, sequence, start, end, hash, 1);
  }

  private static NarrationPartSnapshot part(int sequence, String hash, long durationMs) {
    return new NarrationPartSnapshot(UUID.randomUUID(), sequence, hash, durationMs);
  }

  private static NarrationSpan span(
      UUID revisionId,
      int chapterStart,
      int chapterEnd,
      int globalStart,
      int globalEnd,
      long audioStart,
      long audioEnd) {
    return new NarrationSpan(
        revisionId, chapterStart, chapterEnd, globalStart, globalEnd, audioStart, audioEnd, 0.99);
  }
}
