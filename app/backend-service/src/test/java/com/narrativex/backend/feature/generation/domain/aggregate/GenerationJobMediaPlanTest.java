package com.narrativex.backend.feature.generation.domain.aggregate;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.value.MediaWorkload;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class GenerationJobMediaPlanTest {

  @Test
  void chapterGenerationPinsExactMediaPlanRevisionAndMode() {
    var plan =
        MediaPlan.create(
            10L,
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
            1L, 2L, plan, ResourceClass.GPU_HEAVY, "en", "chapter-generate:10:4", "user-1");

    assertThat(job.getChapterId()).isEqualTo(10L);
    assertThat(job.getChapterRowVersion()).isEqualTo(8L);
    assertThat(job.getSourceHash()).isEqualTo("source-hash");
    assertThat(job.getMediaPlanId()).isEqualTo(plan.id());
    assertThat(job.getMediaPlanRevision()).isEqualTo(4);
    assertThat(job.getProductionMode()).isEqualTo(ProductionMode.HYBRID_LOCAL_I2V);
  }
}
