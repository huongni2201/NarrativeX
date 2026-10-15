package com.narrativex.backend.feature.generation.application.model.prompt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class PromptSettingsTest {
  private final PromptSettings defaults = PromptSettingsDefaults.settings();

  private static PromptStyleProfile style(String id) {
    return new PromptStyleProfile(id, "Style " + id, "positive " + id, "negative " + id, "render");
  }

  private PromptSettings with(List<PromptStyleProfile> styles, String activeId) {
    return new PromptSettings(
        PromptSettings.FORMAT_VERSION,
        0,
        activeId,
        styles,
        defaults.instructions(),
        defaults.videoNegativePrompt());
  }

  @Test
  void rejectsUnknownActiveStyle() {
    assertThatThrownBy(() -> with(List.of(style("A")), "B"))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("activeStyleId");
  }

  @Test
  void rejectsDuplicateStyleIds() {
    assertThatThrownBy(() -> with(List.of(style("A"), style("A")), "A"))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("duplicate id A");
  }

  @Test
  void rejectsEmptyAndTooManyStyles() {
    assertThatThrownBy(() -> with(List.of(), "A")).isInstanceOf(DomainValidationException.class);
    List<PromptStyleProfile> many = new ArrayList<>();
    for (int i = 0; i <= PromptSettings.MAX_STYLES; i++) many.add(style("S" + i));
    assertThatThrownBy(() -> with(many, "S0"))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("at most");
  }

  @Test
  void rejectsInvalidStyleIdAndBlankPositivePrompt() {
    assertThatThrownBy(() -> style("has space")).isInstanceOf(DomainValidationException.class);
    assertThatThrownBy(() -> style("x".repeat(33))).isInstanceOf(DomainValidationException.class);
    assertThatThrownBy(() -> new PromptStyleProfile("A", "Name", "  ", "", ""))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("positivePrompt");
  }

  @Test
  void enforcesPerBlockByteLimitInUtf8() {
    // 'ế' is 3 bytes in UTF-8, so the byte cap trips well before the character count would.
    String tooLong = "ế".repeat(PromptSettings.MAX_BLOCK_BYTES / 3 + 1);
    assertThatThrownBy(() -> new PromptStyleProfile("A", "Name", tooLong, "", ""))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("bytes");
    String exactlyAtLimit = "ế".repeat(PromptSettings.MAX_BLOCK_BYTES / 3);
    assertThat(new PromptStyleProfile("A", "Name", exactlyAtLimit, "", "").positivePrompt())
        .hasSize(PromptSettings.MAX_BLOCK_BYTES / 3);
  }

  @Test
  void enforcesTotalSizeAcrossAllBlocks() {
    String block = "a".repeat(PromptSettings.MAX_BLOCK_BYTES);
    List<PromptStyleProfile> heavy = new ArrayList<>();
    for (int i = 0; i < 6; i++) {
      heavy.add(new PromptStyleProfile("S" + i, "n", block, block, block));
    }
    assertThatThrownBy(() -> with(heavy, "S0"))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("in total");
  }

  @Test
  void rejectsNulCharacters() {
    assertThatThrownBy(() -> new PromptStyleProfile("A", "Name", "bad\u0000text", "", ""))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("NUL");
  }

  @Test
  void normalizesLineEndingsAndSurroundingWhitespace() {
    var normalized = new PromptStyleProfile("A", " Name ", "  line1\r\nline2  ", "", "");
    assertThat(normalized.positivePrompt()).isEqualTo("line1\nline2");
    assertThat(normalized.name()).isEqualTo("Name");
  }

  @Test
  void hashesAreStableAndIgnoreRevision() {
    assertThat(defaults.withRevision(7).semanticHash()).isEqualTo(defaults.semanticHash());
    assertThat(defaults.withRevision(7).effectiveHash()).isEqualTo(defaults.effectiveHash());
    assertThat(defaults.withRevision(7).provenance().revision()).isEqualTo(7);
    assertThat(defaults.provenance().styleId()).isEqualTo(defaults.activeStyleId());
  }

  @Test
  void effectiveHashFollowsTheActiveStyleButSemanticHashCoversEverything() {
    var switched = defaults.withActiveStyle("CINEMATIC");
    assertThat(switched.effectiveHash()).isNotEqualTo(defaults.effectiveHash());
    assertThat(switched.semanticHash()).isNotEqualTo(defaults.semanticHash());
  }

  @Test
  void editingAnInactiveStyleChangesTheSemanticButNotTheEffectiveHash() {
    List<PromptStyleProfile> edited = new ArrayList<>(defaults.styles());
    int index = 1; // CINEMATIC, inactive
    var original = edited.get(index);
    edited.set(
        index,
        new PromptStyleProfile(
            original.id(),
            original.name(),
            original.positivePrompt() + " extra",
            original.negativePrompt(),
            original.characterRenderingPrompt()));
    var changed = with(edited, defaults.activeStyleId());
    assertThat(changed.effectiveHash()).isEqualTo(defaults.effectiveHash());
    assertThat(changed.semanticHash()).isNotEqualTo(defaults.semanticHash());
  }

  @Test
  void canonicalFormIsUnambiguousAcrossFieldBoundaries() {
    var a =
        new PromptSettings(
            1,
            0,
            "A",
            List.of(new PromptStyleProfile("A", "n", "ab", "c", "")),
            defaults.instructions(),
            "");
    var b =
        new PromptSettings(
            1,
            0,
            "A",
            List.of(new PromptStyleProfile("A", "n", "a", "bc", "")),
            defaults.instructions(),
            "");
    assertThat(a.semanticHash()).isNotEqualTo(b.semanticHash());
  }

  @Test
  void rejectsUnsupportedFormatVersionAndNegativeRevision() {
    assertThatThrownBy(
            () ->
                new PromptSettings(
                    2,
                    0,
                    "A",
                    List.of(style("A")),
                    defaults.instructions(),
                    defaults.videoNegativePrompt()))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("formatVersion");
    assertThatThrownBy(() -> defaults.withRevision(-1))
        .isInstanceOf(DomainValidationException.class);
  }
}
