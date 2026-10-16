package com.narrativex.backend.feature.generation.application.model.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisUsageState;
import com.narrativex.backend.feature.generation.infrastructure.analysis.ChapterAnalysisContractResources;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ChapterAnalysisProfileContractTest {
  private static final String VALID_HASH =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  @Test
  void versionedResourcesExposeJsonSchemaWithStableHashes() {
    ChapterAnalysisContractResources contract =
        new ChapterAnalysisContractResources(JsonMapper.builder().build());
    ChapterAnalysisContractResources reloaded =
        new ChapterAnalysisContractResources(JsonMapper.builder().build());

    assertEquals(contract.promptHash(), reloaded.promptHash());
    assertEquals(contract.schemaHash(), reloaded.schemaHash());
    assertEquals(64, contract.promptHash().length());
    assertEquals(64, contract.schemaHash().length());
    assertTrue(contract.systemInstruction("1.2", "1.2").contains("promptVersion=1.2"));

    var jsonSchema = contract.responseSchema();
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
