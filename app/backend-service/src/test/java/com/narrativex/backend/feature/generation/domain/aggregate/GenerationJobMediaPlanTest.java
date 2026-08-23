package com.narrativex.backend.feature.generation.domain.aggregate;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.value.MediaWorkload;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerationJobMediaPlanTest {

  @Test
  void chapterGenerationPinsExactMediaPlanRevisionAndMode() {
    UUID projectId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    var plan =
        MediaPlan.create(
            chapterId,
            8L,
            "source-hash",
            ProductionMode.HYBRID_LOCAL_I2V,
            4,
            List.of(),
            new MediaWorkload(0, 0, 0, 0, 0),
            BigDecimal.ZERO,
            Instant.parse("2026-08-20T00:00:00Z"));

    var job =
        GenerationJob.createChapterGeneration(
            projectId, storyVersionId, plan, ResourceClass.GPU_HEAVY, "en", "chapter-generate:" + chapterId + ":4", "user-1");

    assertThat(job.getChapterId()).isEqualTo(chapterId);
    assertThat(job.getChapterRowVersion()).isEqualTo(8L);
    assertThat(job.getSourceHash()).isEqualTo("source-hash");
    assertThat(job.getMediaPlanId()).isEqualTo(plan.id());
    assertThat(job.getMediaPlanRevision()).isEqualTo(4);
    assertThat(job.getProductionMode()).isEqualTo(ProductionMode.HYBRID_LOCAL_I2V);
  }
}
