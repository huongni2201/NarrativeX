package com.narrativex.backend.feature.generation.application.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerateChapterNarrationCommandTest {
  @Test
  void normalNarrationKeepsPreviewDisabled() {
    var command =
        new GenerateChapterNarrationCommand(
            UUID.randomUUID(), UUID.randomUUID(), "vieneu-default", BigDecimal.ONE, null);

    assertThat(command.preview()).isFalse();
    assertThat(command.previewText()).isNull();
  }

  @Test
  void previewTrimsTextAndRequiresReferenceAsset() {
    UUID referenceAssetId = UUID.randomUUID();
    var reference = new VoiceReferenceSelection(VoiceReferenceScope.PROJECT, referenceAssetId);
    var command =
        new GenerateChapterNarrationCommand(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "vieneu-default",
            BigDecimal.ONE,
            reference,
            "  Xin chào, đây là giọng mẫu.  ");

    assertThat(command.preview()).isTrue();
    assertThat(command.previewText()).isEqualTo("Xin chào, đây là giọng mẫu.");
    assertThat(command.voiceReference()).isEqualTo(reference);
  }

  @Test
  void previewWithoutReferenceUsesCatalogVoice() {
    var command =
        new GenerateChapterNarrationCommand(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "vieneu-preset-minh-quan-pro",
            BigDecimal.ONE,
            null,
            "Giọng mẫu");

    assertThat(command.preview()).isTrue();
    assertThat(command.voiceReference()).isNull();
  }

  @Test
  void previewRejectsOversizedText() {
    assertThatThrownBy(
            () ->
                new GenerateChapterNarrationCommand(
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    "vieneu-default",
                    BigDecimal.ONE,
                    new VoiceReferenceSelection(
                        VoiceReferenceScope.GLOBAL_LOCAL, UUID.randomUUID()),
                    "a".repeat(501)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("500");
  }
}
