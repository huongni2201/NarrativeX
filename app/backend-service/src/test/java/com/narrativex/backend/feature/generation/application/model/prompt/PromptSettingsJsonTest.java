package com.narrativex.backend.feature.generation.application.model.prompt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class PromptSettingsJsonTest {
  private final ObjectMapper mapper = JsonMapper.builder().build();
  private final PromptSettings defaults = PromptSettingsDefaults.settings();

  private JsonNode json() {
    return PromptSettingsJson.toJson(mapper, defaults.withRevision(5));
  }

  @Test
  void roundTripsEveryFieldIncludingRevision() {
    String text = PromptSettingsJson.toJsonString(mapper, defaults.withRevision(5));
    PromptSettings parsed = PromptSettingsJson.parse(mapper, text);

    assertThat(parsed).isEqualTo(defaults.withRevision(5));
    assertThat(parsed.semanticHash()).isEqualTo(defaults.semanticHash());
  }

  @Test
  void revisionTravelsAsADecimalStringAndKeepsBigintPrecision() {
    long beyondDoublePrecision = 9_007_199_254_740_993L; // 2^53 + 1
    JsonNode node = PromptSettingsJson.toJson(mapper, defaults.withRevision(beyondDoublePrecision));
    assertThat(node.get("revision").isString()).isTrue();
    assertThat(node.get("revision").asText()).isEqualTo("9007199254740993");
    assertThat(PromptSettingsJson.parse(node).revision()).isEqualTo(beyondDoublePrecision);
  }

  @Test
  void rejectsNumericOrMalformedRevision() {
    var numeric = (tools.jackson.databind.node.ObjectNode) json();
    numeric.put("revision", 5);
    assertThatThrownBy(() -> PromptSettingsJson.parse(numeric))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("revision");
    var malformed = (tools.jackson.databind.node.ObjectNode) json();
    malformed.put("revision", "5x");
    assertThatThrownBy(() -> PromptSettingsJson.parse(malformed))
        .isInstanceOf(DomainValidationException.class);
  }

  @Test
  void missingRevisionMeansUnsavedDraft() {
    var node = (tools.jackson.databind.node.ObjectNode) json();
    node.remove("revision");
    assertThat(PromptSettingsJson.parse(node).revision()).isZero();
  }

  @Test
  void rejectsUnknownFieldsAtEveryLevel() {
    var root = (tools.jackson.databind.node.ObjectNode) json();
    root.put("surprise", "x");
    assertThatThrownBy(() -> PromptSettingsJson.parse(root))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("surprise");

    var nestedStyle = (tools.jackson.databind.node.ObjectNode) json();
    ((tools.jackson.databind.node.ObjectNode) nestedStyle.get("styles").get(0)).put("extra", 1);
    assertThatThrownBy(() -> PromptSettingsJson.parse(nestedStyle))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("extra");

    var nestedInstructions = (tools.jackson.databind.node.ObjectNode) json();
    ((tools.jackson.databind.node.ObjectNode) nestedInstructions.get("instructions"))
        .put("hidden", "x");
    assertThatThrownBy(() -> PromptSettingsJson.parse(nestedInstructions))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("hidden");
  }

  @Test
  void rejectsWrongTypesAndMalformedJson() {
    assertThatThrownBy(() -> PromptSettingsJson.parse(mapper, "{not json"))
        .isInstanceOf(DomainValidationException.class);
    assertThatThrownBy(() -> PromptSettingsJson.parse(mapper, " "))
        .isInstanceOf(DomainValidationException.class);
    var wrongStyles = (tools.jackson.databind.node.ObjectNode) json();
    wrongStyles.put("styles", "nope");
    assertThatThrownBy(() -> PromptSettingsJson.parse(wrongStyles))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("styles");
    var wrongText = (tools.jackson.databind.node.ObjectNode) json();
    wrongText.put("activeStyleId", 12);
    assertThatThrownBy(() -> PromptSettingsJson.parse(wrongText))
        .isInstanceOf(DomainValidationException.class);
  }
}
