package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;

/** Validates the JSON Schema subset used by the packaged Chapter Analysis contracts. */
final class ChapterAnalysisJsonSchemaValidator {
  private static final int MAX_FINDINGS = 50;

  private ChapterAnalysisJsonSchemaValidator() {}

  static List<Finding> validate(JsonNode value, JsonNode schema) {
    List<Finding> findings = new ArrayList<>();
    inspect(value, schema, "$", findings);
    return List.copyOf(findings);
  }

  private static void inspect(
      JsonNode value, JsonNode schema, String path, List<Finding> findings) {
    if (findings.size() >= MAX_FINDINGS) return;
    String type = schema.path("type").asText("");
    if (!matchesType(value, type)) {
      findings.add(new Finding(path, "must be " + (type.isBlank() ? "valid" : type)));
      return;
    }
    if (!schemaMatchesEnum(value, schema)) {
      findings.add(new Finding(path, "must use one of the allowed values"));
      return;
    }

    switch (type) {
      case "object" -> inspectObject(value, schema, path, findings);
      case "array" -> inspectArray(value, schema, path, findings);
      case "string" -> inspectString(value, schema, path, findings);
      case "integer", "number" -> inspectNumber(value, schema, path, findings);
      default -> {
        // The packaged Chapter Analysis schemas use only the types handled above.
      }
    }
  }

  private static void inspectObject(
      JsonNode value, JsonNode schema, String path, List<Finding> findings) {
    JsonNode required = schema.get("required");
    if (required != null && required.isArray()) {
      for (JsonNode field : required) {
        if (field.isTextual() && !value.has(field.asText())) {
          findings.add(new Finding(path + "." + field.asText(), "is required"));
          if (findings.size() >= MAX_FINDINGS) return;
        }
      }
    }

    JsonNode properties = schema.get("properties");
    if (properties != null && properties.isObject()) {
      value
          .properties()
          .forEach(
              entry -> {
                JsonNode propertySchema = properties.get(entry.getKey());
                if (propertySchema == null
                    && schema.path("additionalProperties").asBoolean(true) == false) {
                  findings.add(new Finding(path + "." + entry.getKey(), "is not allowed"));
                } else if (propertySchema != null) {
                  inspect(entry.getValue(), propertySchema, path + "." + entry.getKey(), findings);
                }
              });
    }
  }

  private static void inspectArray(
      JsonNode value, JsonNode schema, String path, List<Finding> findings) {
    checkBound(value.size(), schema, "minItems", path, "has too few items", findings);
    checkBound(value.size(), schema, "maxItems", path, "has too many items", findings);
    JsonNode itemSchema = schema.get("items");
    if (itemSchema == null) return;
    for (int index = 0; index < value.size() && findings.size() < MAX_FINDINGS; index++) {
      inspect(value.get(index), itemSchema, path + "[" + index + "]", findings);
    }
  }

  private static void inspectString(
      JsonNode value, JsonNode schema, String path, List<Finding> findings) {
    int length = value.asText().codePointCount(0, value.asText().length());
    checkBound(length, schema, "minLength", path, "is too short", findings);
    checkBound(length, schema, "maxLength", path, "is too long", findings);
  }

  private static void inspectNumber(
      JsonNode value, JsonNode schema, String path, List<Finding> findings) {
    JsonNode minimum = schema.get("minimum");
    if (minimum != null && minimum.isNumber() && value.doubleValue() < minimum.doubleValue()) {
      findings.add(new Finding(path, "is below the minimum"));
    }
    JsonNode maximum = schema.get("maximum");
    if (maximum != null && maximum.isNumber() && value.doubleValue() > maximum.doubleValue()) {
      findings.add(new Finding(path, "is above the maximum"));
    }
  }

  private static void checkBound(
      int value,
      JsonNode schema,
      String name,
      String path,
      String message,
      List<Finding> findings) {
    JsonNode bound = schema.get(name);
    if (bound != null && bound.canConvertToInt()) {
      int limit = bound.asInt();
      if ((name.startsWith("min") && value < limit) || (name.startsWith("max") && value > limit)) {
        findings.add(new Finding(path, message));
      }
    }
  }

  private static boolean matchesType(JsonNode value, String type) {
    if (value == null || value.isNull()) return false;
    return switch (type) {
      case "object" -> value.isObject();
      case "array" -> value.isArray();
      case "string" -> value.isTextual();
      case "integer" -> value.isIntegralNumber();
      case "number" -> value.isNumber();
      case "boolean" -> value.isBoolean();
      default -> true;
    };
  }

  private static boolean schemaMatchesEnum(JsonNode value, JsonNode schema) {
    JsonNode allowed = schema.get("enum");
    if (allowed == null || !allowed.isArray()) return true;
    for (JsonNode candidate : allowed) {
      if (candidate.equals(value)) return true;
    }
    return false;
  }

  record Finding(String path, String message) {}
}
