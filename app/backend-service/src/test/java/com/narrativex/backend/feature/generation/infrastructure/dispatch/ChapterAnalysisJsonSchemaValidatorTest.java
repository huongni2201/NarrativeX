package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisStage;
import com.narrativex.backend.feature.generation.infrastructure.analysis.ChapterAnalysisContractResources;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ChapterAnalysisJsonSchemaValidatorTest {
  private final JsonMapper json = JsonMapper.builder().build();
  private final ChapterAnalysisContractResources resources =
      new ChapterAnalysisContractResources(json);

  @Test
  void eachStageRejectsTheOtherStagesFieldsAndUnknownProperties() {
    var stages = resources.stageContracts(null);
    var canon = json.createObjectNode();
    canon.putArray("characters");
    canon.putArray("locations");
    var mixedCanon = json.createObjectNode().set("canon", canon.deepCopy());
    mixedCanon.putArray("scenes");
    var mixedStory = json.createObjectNode().set("canon", canon.deepCopy());
    mixedStory.putArray("scenes");

    assertThat(
            ChapterAnalysisJsonSchemaValidator.validate(
                mixedCanon, stages.get(ChapterAnalysisStage.CANON).responseSchema()))
        .anySatisfy(finding -> assertThat(finding.path()).isEqualTo("$.scenes"));
    assertThat(
            ChapterAnalysisJsonSchemaValidator.validate(
                mixedStory, stages.get(ChapterAnalysisStage.STORY).responseSchema()))
        .anySatisfy(finding -> assertThat(finding.path()).isEqualTo("$.canon"));
  }

  @Test
  void canonSchemaChecksRequiredFieldsEnumsAndIdentityLengths() {
    var stage = resources.stageContracts(null).get(ChapterAnalysisStage.CANON);
    var output =
        json.createObjectNode()
            .set(
                "canon",
                json.createObjectNode()
                    .set(
                        "characters",
                        json.createArrayNode()
                            .add(
                                json.createObjectNode()
                                    .put("ai_name", "A".repeat(161))
                                    .put("canonical_name", "Lan")
                                    .put("role", "SIDEKICK")
                                    .put("importance", "PRIMARY")
                                    .put("visual_prompt", "A portrait")))
                    .set("locations", json.createArrayNode()));

    var findings = ChapterAnalysisJsonSchemaValidator.validate(output, stage.responseSchema());
    assertThat(findings)
        .anySatisfy(
            finding -> assertThat(finding.path()).isEqualTo("$.canon.characters[0].ai_name"))
        .anySatisfy(
            finding -> assertThat(finding.path()).isEqualTo("$.canon.characters[0].description"))
        .anySatisfy(finding -> assertThat(finding.path()).isEqualTo("$.canon.characters[0].role"));
  }

  private tools.jackson.databind.JsonNode read(String value) {
    return json.readTree(value);
  }
}
