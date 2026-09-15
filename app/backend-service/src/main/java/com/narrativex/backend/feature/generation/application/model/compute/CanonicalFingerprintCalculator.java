package com.narrativex.backend.feature.generation.application.model.compute;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

public final class CanonicalFingerprintCalculator {
  private static final ObjectMapper MAPPER = JsonMapper.builder().build();

  private CanonicalFingerprintCalculator() {}

  public static String calculateFingerprint(
      String protocolVersion,
      TaskDescriptorDto task,
      ModelRefDto model,
      TaskConstraintsDto constraints,
      Map<String, Object> inputs,
      TaskArtifactsDto artifacts) {
    Map<String, Object> payload = new TreeMap<>();
    payload.put("protocolVersion", protocolVersion);

    Map<String, Object> taskMap = new TreeMap<>();
    taskMap.put("type", task.type());
    taskMap.put("schemaVersion", task.schemaVersion());
    payload.put("task", taskMap);

    Map<String, Object> modelMap = new TreeMap<>();
    modelMap.put("executor", model.executor());
    modelMap.put("model", model.model());
    modelMap.put("revision", model.revision());
    payload.put("model", modelMap);

    Map<String, Object> constraintsMap = new TreeMap<>();
    constraintsMap.put("deadline", DateTimeFormatter.ISO_INSTANT.format(constraints.deadline()));
    constraintsMap.put("maxRuntimeSeconds", constraints.maxRuntimeSeconds());
    payload.put("constraints", constraintsMap);

    payload.put("inputs", toCanonicalObject(inputs));

    Map<String, Object> artifactsMap = new TreeMap<>();
    List<Map<String, Object>> inputArtifacts = new ArrayList<>();
    if (artifacts != null && artifacts.inputs() != null) {
      for (InputArtifactRefDto input : artifacts.inputs()) {
        Map<String, Object> item = new TreeMap<>();
        item.put("artifactId", input.artifactId().toString());
        item.put("role", input.role());
        item.put("mediaType", input.mediaType());
        item.put("sizeBytes", input.sizeBytes());
        item.put("sha256", input.sha256());
        inputArtifacts.add(item);
      }
    }
    artifactsMap.put("inputs", inputArtifacts);

    List<Map<String, Object>> outputArtifacts = new ArrayList<>();
    if (artifacts != null && artifacts.outputs() != null) {
      for (OutputArtifactTargetDto output : artifacts.outputs()) {
        Map<String, Object> item = new TreeMap<>();
        item.put("artifactId", output.artifactId().toString());
        item.put("role", output.role());
        item.put("mediaType", output.mediaType());
        outputArtifacts.add(item);
      }
    }
    artifactsMap.put("outputs", outputArtifacts);

    payload.put("artifacts", artifactsMap);

    try {
      String json = MAPPER.writeValueAsString(payload);
      return sha256Hex(json.getBytes(StandardCharsets.UTF_8));
    } catch (JacksonException e) {
      throw new IllegalStateException("Failed to serialize canonical payload for fingerprint", e);
    }
  }

  public static String calculateFingerprint(ComputeTaskRequest request) {
    return calculateFingerprint(
        request.protocolVersion(),
        request.task(),
        request.model(),
        request.constraints(),
        request.inputs(),
        request.artifacts());
  }

  @SuppressWarnings("unchecked")
  private static Object toCanonicalObject(Object obj) {
    if (obj == null) {
      return null;
    }
    if (obj instanceof Map<?, ?> map) {
      Map<String, Object> sorted = new TreeMap<>();
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        sorted.put(String.valueOf(entry.getKey()), toCanonicalObject(entry.getValue()));
      }
      return sorted;
    }
    if (obj instanceof List<?> list) {
      List<Object> converted = new ArrayList<>(list.size());
      for (Object item : list) {
        converted.add(toCanonicalObject(item));
      }
      return converted;
    }
    if (obj instanceof Instant instant) {
      return DateTimeFormatter.ISO_INSTANT.format(instant);
    }
    if (obj instanceof UUID uuid) {
      return uuid.toString();
    }
    return obj;
  }

  private static String sha256Hex(byte[] bytes) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(bytes);
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 algorithm unavailable", e);
    }
  }
}
