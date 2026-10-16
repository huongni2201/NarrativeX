package com.narrativex.backend.feature.generation.application.model.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ChapterCanonParserTest {
  private static AnalyzedCharacter parseCharacter(String role, String importance) {
    String roleField = role == null ? "" : ",\"role\":\"" + role + "\"";
    String importanceField = importance == null ? "" : ",\"importance\":\"" + importance + "\"";
    String json =
        "{\"characters\":[{\"ai_name\":\"an\",\"canonical_name\":\"An\""
            + roleField
            + importanceField
            + "}]}";
    return ChapterCanonParser.parse(json).characters().get(0);
  }

  @Test
  void keepsValuesTheDatabaseAccepts() {
    AnalyzedCharacter character = parseCharacter("ANTAGONIST", "BACKGROUND");

    assertThat(character.role()).isEqualTo("ANTAGONIST");
    assertThat(character.importance()).isEqualTo("BACKGROUND");
  }

  @Test
  void normalizesCaseAndSeparatorsInsteadOfFailingTheAnalysis() {
    AnalyzedCharacter character = parseCharacter(" protagonist ", "primary");

    assertThat(character.role()).isEqualTo("PROTAGONIST");
    assertThat(character.importance()).isEqualTo("PRIMARY");
  }

  @Test
  void fallsBackToSafeDefaultsForLabelsTheDatabaseRejects() {
    AnalyzedCharacter unknown = parseCharacter("MAIN", "VERY_IMPORTANT");
    AnalyzedCharacter missing = parseCharacter(null, null);

    assertThat(unknown.role()).isEqualTo("SUPPORTING");
    assertThat(unknown.importance()).isEqualTo("SECONDARY");
    assertThat(missing.role()).isEqualTo("SUPPORTING");
    assertThat(missing.importance()).isEqualTo("SECONDARY");
  }
}
