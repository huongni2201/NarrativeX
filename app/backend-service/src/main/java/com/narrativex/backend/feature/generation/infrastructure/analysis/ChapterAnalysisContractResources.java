package com.narrativex.backend.feature.generation.infrastructure.analysis;

import com.narrativex.backend.feature.generation.application.model.analysis.CanonHashCalculator;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Versioned, transport-neutral prompt and response schema for Chapter Analysis. */
public final class ChapterAnalysisContractResources {
  private static final String RESOURCE_ROOT = "/analysis/chapter-analysis/1.1/";
  private final String promptTemplate;
  private final String promptHash;
  private final ObjectMapper objectMapper;
  private final JsonNode responseSchema;
  private final String schemaHash;

  public ChapterAnalysisContractResources(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
    byte[] promptBytes = readResource("prompt.txt");
    byte[] schemaBytes = readResource("response.schema.json");
    this.promptTemplate = new String(promptBytes, StandardCharsets.UTF_8).strip();
    this.promptHash = CanonHashCalculator.sha256(this.promptTemplate);
    this.responseSchema = parseSchema(objectMapper, schemaBytes);
    this.schemaHash = CanonHashCalculator.sha256(new String(schemaBytes, StandardCharsets.UTF_8));
  }

  public String systemInstruction(String promptVersion, String schemaVersion) {
    if (!"1.1".equals(promptVersion) || !"1.1".equals(schemaVersion)) {
      throw new IllegalArgumentException("Only the Chapter Analysis 1.1 contract is available");
    }
    return promptTemplate
        .replace("{promptVersion}", promptVersion)
        .replace("{schemaVersion}", schemaVersion);
  }

  public JsonNode responseSchema() {
    return responseSchema.deepCopy();
  }

  /** Converts the shared JSON Schema type names to the Vertex responseSchema dialect. */
  public JsonNode vertexResponseSchema() {
    return toVertexDialect(responseSchema);
  }

  public String promptHash() {
    return promptHash;
  }

  public String schemaHash() {
    return schemaHash;
  }

  private static JsonNode parseSchema(ObjectMapper objectMapper, byte[] schemaBytes) {
    JsonNode schema = objectMapper.readTree(schemaBytes);
    if (schema == null || !schema.isObject() || !schema.path("properties").isObject()) {
      throw new IllegalStateException("Chapter Analysis 1.1 schema must be a non-empty object");
    }
    return schema;
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

  private JsonNode toVertexDialect(JsonNode schema) {
    if (schema.isObject()) {
      ObjectNode result = objectMapper.createObjectNode();
      Iterator<Map.Entry<String, JsonNode>> fields = schema.properties().iterator();
      while (fields.hasNext()) {
        Map.Entry<String, JsonNode> field = fields.next();
        JsonNode value = field.getValue();
        if ("type".equals(field.getKey()) && value.isTextual()) {
          result.put(field.getKey(), value.asText().toUpperCase(java.util.Locale.ROOT));
        } else if ("properties".equals(field.getKey()) && value.isObject()) {
          ObjectNode properties = result.putObject(field.getKey());
          value
              .properties()
              .forEach(
                  property ->
                      properties.set(property.getKey(), toVertexDialect(property.getValue())));
        } else {
          result.set(field.getKey(), toVertexDialect(value));
        }
      }
      return result;
    }
    if (schema.isArray()) {
      var result = objectMapper.createArrayNode();
      schema.forEach(value -> result.add(toVertexDialect(value)));
      return result;
    }
    return schema.deepCopy();
  }
}
