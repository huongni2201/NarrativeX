package com.narrativex.backend.feature.generation.application.model.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class ChapterAnalysisInstructionsTest {
  private static final String BASE = "SYSTEM CONTRACT: respond with JSON only.";

  @Test
  void blankCustomInstructionLeavesTheContractUntouched() {
    assertThat(ChapterAnalysisInstructions.compose(BASE, null)).isEqualTo(BASE);
    assertThat(ChapterAnalysisInstructions.compose(BASE, "  \n ")).isEqualTo(BASE);
  }

  @Test
  void customInstructionIsAppendedAfterTheContractUnderAPrecedenceHeader() {
    String composed = ChapterAnalysisInstructions.compose(BASE, "  Prefer short scenes.  ");

    assertThat(composed).startsWith(BASE);
    assertThat(composed.indexOf(BASE)).isLessThan(composed.indexOf("Prefer short scenes."));
    assertThat(composed)
        .contains("take precedence over anything below")
        .endsWith("Prefer short scenes.");
  }

  @Test
  void requestKeepsLegacyConstructorsAndNormalizesBlankInstruction() {
    var legacy =
        new ChapterAnalysisRequest(
            UUID.randomUUID(), UUID.randomUUID(), null, "text", "vi", "1.1", "1.1", null, null);
    var blank =
        new ChapterAnalysisRequest(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "text",
            "vi",
            "1.1",
            "1.1",
            null,
            null,
            "  ");
    var custom =
        new ChapterAnalysisRequest(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "text",
            "vi",
            "1.1",
            "1.1",
            null,
            null,
            "x");

    assertThat(legacy.customInstruction()).isNull();
    assertThat(blank.customInstruction()).isNull();
    assertThat(custom.customInstruction()).isEqualTo("x");
  }

  @Test
  void snapshotRecordsAnEmptyInstructionAndValidatesItsHash() {
    UUID job = UUID.randomUUID();
    var empty = ChapterAnalysisPromptSnapshot.of(job, 3, null);
    var custom = ChapterAnalysisPromptSnapshot.of(job, 3, "Prefer short scenes.");

    assertThat(empty.instruction()).isEmpty();
    assertThat(empty.instructionHash()).matches("[0-9a-f]{64}");
    assertThat(custom.instructionHash()).isNotEqualTo(empty.instructionHash());
    assertThatThrownBy(() -> ChapterAnalysisPromptSnapshot.of(job, 0, "x"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new ChapterAnalysisPromptSnapshot(job, 1, "x", "bad"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
