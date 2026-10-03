package com.narrativex.backend.feature.generation.domain.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerationJobCopyTest {
  @Test
  void copiesEverySnapshotAndCheckpointWithoutLosingInheritedIdentity() {
    var now = Instant.parse("2026-10-03T00:00:00Z");
    var original =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.GPU_HEAVY)
            .toBuilder()
            .id(UUID.randomUUID())
            .rowVersion(42L)
            .storyVersionId(UUID.randomUUID())
            .chapterId(UUID.randomUUID())
            .storyboardRevisionId(UUID.randomUUID())
            .chapterRowVersion(7L)
            .sourceHash("hash")
            .sourceText("private story")
            .sourceLanguage("vi")
            .idempotencyKey("replay")
            .currentStep("waiting")
            .errorCode("AMBIGUOUS_OUTCOME")
            .mediaPlanId(UUID.randomUUID())
            .mediaPlanRevision(4)
            .productionMode(ProductionMode.VIDEO_FIRST)
            .submissionState("UNKNOWN")
            .computeAttemptId(UUID.randomUUID())
            .computeExecutionHandle("handle")
            .computeSequence(12L)
            .lastComputeState("RUNNING")
            .submittedAt(now)
            .startedAt(now.plusSeconds(1))
            .completedAt(now.plusSeconds(2))
            .lastReconciledAt(now.plusSeconds(3))
            .nextReconcileAt(now.plusSeconds(4))
            .reconcileAttemptCount(3)
            .lastEventId("event")
            .lastEventSequence(11L)
            .callbackReceivedAt(now.plusSeconds(5))
            .build();

    assertThat(original.toBuilder().build()).usingRecursiveComparison().isEqualTo(original);
    assertThat(original.toBuilder().progress(17).build())
        .usingRecursiveComparison()
        .ignoringFields("progress")
        .isEqualTo(original);
    assertThat(original.toBuilder().toString()).doesNotContain("private story", "replay", "handle");
    assertThatThrownBy(() -> original.toBuilder().progress(101).build())
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void copiesAnalysisPreferencesAndKeepsPublicBuilderConstructor() {
    var original =
        GenerationJob.createChapterAnalysis(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            3L,
            "hash",
            "private analysis",
            "vi",
            "analysis-replay",
            "IMAGE",
            "API");
    assertThat(original.toBuilder().build()).usingRecursiveComparison().isEqualTo(original);
    assertThat(new GenerationJob.Builder().toString()).doesNotContain("private analysis");
  }
}
