package com.narrativex.backend.feature.generation.application.model.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisUsageState;
import com.narrativex.backend.feature.generation.infrastructure.analysis.ChapterAnalysisContractResources;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

class ChapterAnalysisProfileContractTest {
  private static final String VALID_HASH =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  @Test
  void versionedResourcesExposeJsonSchemaWithStableHashes() throws Exception {
    var mapper = JsonMapper.builder().build();
    ChapterAnalysisContractResources contract = new ChapterAnalysisContractResources(mapper);
    ChapterAnalysisContractResources reloaded = new ChapterAnalysisContractResources(mapper);

    assertEquals(contract.promptHash(), reloaded.promptHash());
    assertEquals(contract.schemaHash(), reloaded.schemaHash());
    assertEquals(64, contract.promptHash().length());
    assertEquals(64, contract.schemaHash().length());
    assertEquals("1.3", ChapterAnalysisContractResources.VERSION);

    var stages = contract.stageContracts(null);
    var reloadedStages = reloaded.stageContracts(null);
    assertEquals(stages, reloadedStages);
    String stageJson = mapper.writeValueAsString(stages);
    Map<ChapterAnalysisStage, ChapterAnalysisStageContract> roundTrippedStages =
        mapper.readValue(
            stageJson,
            new TypeReference<Map<ChapterAnalysisStage, ChapterAnalysisStageContract>>() {});
    assertEquals(stages, roundTrippedStages);
    assertEquals(
        ChapterAnalysisContractResources.promptHash(stages),
        ChapterAnalysisContractResources.promptHash(reloadedStages));
    assertEquals(contract.schemaHash(stages), reloaded.schemaHash(reloadedStages));
    assertTrue(
        stages.get(ChapterAnalysisStage.CANON).promptTemplate().contains("promptVersion=1.3"),
        stages.get(ChapterAnalysisStage.CANON).promptTemplate());
    assertTrue(stages.get(ChapterAnalysisStage.STORY).promptTemplate().contains("STORY stage"));

    var canonSchema = stages.get(ChapterAnalysisStage.CANON).responseSchema();
    var storySchema = stages.get(ChapterAnalysisStage.STORY).responseSchema();
    assertEquals("object", canonSchema.path("type").asText());
    assertTrue(canonSchema.at("/properties/canon/properties/characters/items").isObject());
    assertFalse(canonSchema.at("/properties/scenes").isObject());
    assertTrue(storySchema.at("/properties/scenes/items/properties/visual_beats/items").isObject());
    assertFalse(storySchema.at("/properties/canon").isObject());

    var jsonSchema = contract.finalResponseSchema();
    assertEquals("object", jsonSchema.path("type").asText());
    assertEquals(
        "integer",
        jsonSchema
            .at(
                "/properties/scenes/items/properties/visual_beats/items/properties/visual_direction/properties/lens_mm/type")
            .asText());
    assertTrue(
        jsonSchema
            .at(
                "/properties/scenes/items/properties/visual_beats/items/properties/audio_cues/items")
            .isObject());
    assertNotNull(jsonSchema.at("/properties/canon/properties/characters/items"));
  }

  @Test
  void customInstructionIsFrozenIntoEachProtectedStageContract() {
    var resources = new ChapterAnalysisContractResources(JsonMapper.builder().build());
    var stages = resources.stageContracts("Prefer concise scene descriptions.");

    for (ChapterAnalysisStage stage : ChapterAnalysisStage.values()) {
      assertTrue(stages.get(stage).promptTemplate().contains("Prefer concise scene descriptions."));
      assertTrue(
          stages.get(stage).promptTemplate().contains("take precedence over anything below"));
      assertEquals(64, stages.get(stage).promptHash().length());
      assertEquals(64, stages.get(stage).schemaHash().length());
    }
  }

  @Test
  void chapterAnalysisRequestPreservesUnicodeSourceText() throws Exception {
    var mapper = JsonMapper.builder().build();
    var request =
        ChapterAnalysisRequest.simple(
            UUID.randomUUID(), UUID.randomUUID(), "Cô ấy nói: ‘Xin chào世界’.", "vi");
    var serialized = mapper.writeValueAsString(request);

    assertEquals(request.sourceText(), mapper.readTree(serialized).path("sourceText").asText());
  }

  @Test
  void executionProfileRejectsInvalidModelEffortAndHashes() {
    assertThrows(
        IllegalArgumentException.class, () -> profile("gemini --model bad", "HIGH", VALID_HASH));
    assertThrows(
        IllegalArgumentException.class, () -> profile("gemini-3.8-flash", "EXTREME", VALID_HASH));
    assertThrows(
        IllegalArgumentException.class, () -> profile("gemini-3.8-flash", "HIGH", "not-a-hash"));
  }

  @Test
  void usageDistinguishesMissingMetricsFromReportedZero() {
    ChapterAnalysisUsage unknown = new ChapterAnalysisUsage(null, null, null, null, null, 20);
    ChapterAnalysisUsage reportedZero = new ChapterAnalysisUsage(0L, 0L, 0L, 0L, 0L, 20);
    ChapterAnalysisUsage partial = new ChapterAnalysisUsage(10L, null, null, null, null, 20);

    assertEquals(ChapterAnalysisUsageState.UNKNOWN, unknown.usageState());
    assertEquals(ChapterAnalysisUsageState.REPORTED, reportedZero.usageState());
    assertEquals(ChapterAnalysisUsageState.PARTIAL, partial.usageState());
    assertFalse(unknown.promptTokens() != null);
    assertThrows(
        IllegalArgumentException.class,
        () -> new ChapterAnalysisUsage(-1L, null, null, null, null, 0));
  }

  @Test
  void unknownInputBudgetDoesNotInventTokenCount() {
    ChapterAnalysisInputBudget budget =
        new ChapterAnalysisInputBudget(ChapterAnalysisInputBudget.Accuracy.UNKNOWN, null, 120, 512);

    assertFalse(budget.exceedsByteLimit());
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new ChapterAnalysisInputBudget(
                ChapterAnalysisInputBudget.Accuracy.UNKNOWN, 0L, 120, 512));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new ChapterAnalysisInputBudget(
                ChapterAnalysisInputBudget.Accuracy.EXACT, null, 120, 512));
  }

  private static ChapterAnalysisExecutionProfile profile(String model, String effort, String hash) {
    return new ChapterAnalysisExecutionProfile(
        ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI,
        model,
        effort,
        "1.1",
        hash,
        "1.1",
        VALID_HASH);
  }
}
