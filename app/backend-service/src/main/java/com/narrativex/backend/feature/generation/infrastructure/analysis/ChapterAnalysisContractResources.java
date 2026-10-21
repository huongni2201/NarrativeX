package com.narrativex.backend.feature.generation.infrastructure.analysis;

import com.narrativex.backend.feature.generation.application.model.analysis.CanonHashCalculator;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisInstructions;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisStage;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisStageContract;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Versioned CANON, STORY, and final result contracts for Chapter Analysis. */
public final class ChapterAnalysisContractResources {
  public static final String VERSION = "1.3";

  private static final String RESOURCE_ROOT = "/analysis/chapter-analysis/" + VERSION + "/";

  private final Map<ChapterAnalysisStage, StageResource> stages;
  private final JsonNode finalResponseSchema;
  private final String finalSchemaHash;

  public ChapterAnalysisContractResources(ObjectMapper objectMapper) {
    EnumMap<ChapterAnalysisStage, StageResource> loaded = new EnumMap<>(ChapterAnalysisStage.class);
    loaded.put(
        ChapterAnalysisStage.CANON, readStage(objectMapper, ChapterAnalysisStage.CANON, "canon"));
    loaded.put(
        ChapterAnalysisStage.STORY, readStage(objectMapper, ChapterAnalysisStage.STORY, "story"));
    this.stages = Map.copyOf(loaded);

    byte[] finalSchemaBytes = readResource("final.response.schema.json");
    this.finalResponseSchema = parseSchema(objectMapper, finalSchemaBytes, "final result");
    this.finalSchemaHash = hash(finalSchemaBytes);
  }

  public Map<ChapterAnalysisStage, ChapterAnalysisStageContract> stageContracts(
      String customInstruction) {
    EnumMap<ChapterAnalysisStage, ChapterAnalysisStageContract> contracts =
        new EnumMap<>(ChapterAnalysisStage.class);
    stages.forEach(
        (stage, resource) -> {
          String instruction =
              ChapterAnalysisInstructions.compose(resource.promptTemplate(), customInstruction);
          contracts.put(
              stage,
              new ChapterAnalysisStageContract(
                  instruction,
                  resource.responseSchema(),
                  CanonHashCalculator.sha256(instruction),
                  resource.schemaHash()));
        });
    return Map.copyOf(contracts);
  }

  public JsonNode finalResponseSchema() {
    return finalResponseSchema.deepCopy();
  }

  /** Composite hash for the frozen CANON and STORY prompts, including custom instructions. */
  public static String promptHash(
      Map<ChapterAnalysisStage, ChapterAnalysisStageContract> stageContracts) {
    return CanonHashCalculator.sha256(
        ChapterAnalysisStage.CANON.name()
            + ":"
            + stageContracts.get(ChapterAnalysisStage.CANON).promptHash()
            + "\n"
            + ChapterAnalysisStage.STORY.name()
            + ":"
            + stageContracts.get(ChapterAnalysisStage.STORY).promptHash());
  }

  /** Composite hash includes each stage schema and the final materialization schema. */
  public String schemaHash(Map<ChapterAnalysisStage, ChapterAnalysisStageContract> stageContracts) {
    return CanonHashCalculator.sha256(
        ChapterAnalysisStage.CANON.name()
            + ":"
            + stageContracts.get(ChapterAnalysisStage.CANON).schemaHash()
            + "\n"
            + ChapterAnalysisStage.STORY.name()
            + ":"
            + stageContracts.get(ChapterAnalysisStage.STORY).schemaHash()
            + "\nFINAL:"
            + finalSchemaHash);
  }

  /** Stable resource-only hash, useful for proving packaged defaults are deterministic. */
  public String promptHash() {
    EnumMap<ChapterAnalysisStage, ChapterAnalysisStageContract> defaults =
        new EnumMap<>(ChapterAnalysisStage.class);
    stages.forEach(
        (stage, resource) ->
            defaults.put(
                stage,
                new ChapterAnalysisStageContract(
                    resource.promptTemplate(),
                    resource.responseSchema(),
                    resource.promptHash(),
                    resource.schemaHash())));
    return promptHash(defaults);
  }

  /** Stable resource-only hash, including the result schema used at completion. */
  public String schemaHash() {
    EnumMap<ChapterAnalysisStage, ChapterAnalysisStageContract> defaults =
        new EnumMap<>(ChapterAnalysisStage.class);
    stages.forEach(
        (stage, resource) ->
            defaults.put(
                stage,
                new ChapterAnalysisStageContract(
                    resource.promptTemplate(),
                    resource.responseSchema(),
                    resource.promptHash(),
                    resource.schemaHash())));
    return schemaHash(defaults);
  }

  private StageResource readStage(
      ObjectMapper objectMapper, ChapterAnalysisStage stage, String resourceName) {
    byte[] promptBytes = readResource(resourceName + ".prompt.txt");
    byte[] schemaBytes = readResource(resourceName + ".response.schema.json");
    String prompt =
        new String(promptBytes, StandardCharsets.UTF_8)
            .strip()
            .replace("{promptVersion}", VERSION)
            .replace("{schemaVersion}", VERSION);
    JsonNode schema = parseSchema(objectMapper, schemaBytes, stage.name());
    return new StageResource(prompt, schema, CanonHashCalculator.sha256(prompt), hash(schemaBytes));
  }

  private static JsonNode parseSchema(ObjectMapper objectMapper, byte[] bytes, String name) {
    JsonNode schema = objectMapper.readTree(bytes);
    if (schema == null || !schema.isObject() || !schema.path("properties").isObject()) {
      throw new IllegalStateException(
          "Chapter Analysis " + VERSION + " " + name + " schema is invalid");
    }
    return schema.deepCopy();
  }

  private static String hash(byte[] bytes) {
    return CanonHashCalculator.sha256(new String(bytes, StandardCharsets.UTF_8));
  }

  private static byte[] readResource(String name) {
    String path = RESOURCE_ROOT + name;
    try (InputStream input = ChapterAnalysisContractResources.class.getResourceAsStream(path)) {
      if (input == null) throw new IllegalStateException("Missing analysis contract: " + path);
      return input.readAllBytes();
    } catch (IOException exception) {
      throw new IllegalStateException("Could not read analysis contract: " + path, exception);
    }
  }

  private record StageResource(
      String promptTemplate, JsonNode responseSchema, String promptHash, String schemaHash) {}
}
