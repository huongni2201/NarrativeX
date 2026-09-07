package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.BeatSnapshot;
import com.narrativex.backend.feature.generation.application.usecase.PrepareStoryboardGenerationBatchUseCase.PreparedBatch;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import tools.jackson.databind.ObjectMapper;

public record StoryboardGenerationBatchResponse(
    UUID batchId,
    UUID storyboardRevisionId,
    String sourceHash,
    UUID continuityPlanId,
    Integer continuityPlanRevision,
    Integer continuityReportRevision,
    String stylePolicyVersion,
    String providerPolicyVersion,
    String requestFingerprint,
    boolean stale,
    boolean hasBlockingIssues,
    List<Issue> issues,
    List<Beat> beats) {

  public static StoryboardGenerationBatchResponse from(PreparedBatch prepared, ObjectMapper objectMapper) {
    var batch = prepared.batch();
    return new StoryboardGenerationBatchResponse(
        batch.id(),
        batch.storyboardRevisionId(),
        batch.sourceHash(),
        batch.continuityPlanId(),
        batch.continuityPlanRevision(),
        batch.continuityReportRevision(),
        batch.stylePolicyVersion(),
        batch.providerPolicyVersion(),
        batch.requestFingerprint(),
        prepared.stale(),
        prepared.hasBlockingIssues(),
        prepared.issues().stream()
            .map(issue -> new Issue(issue.code(), issue.severity(), issue.visualBeatId(), issue.message()))
            .toList(),
        batch.beats().stream().map(beat -> Beat.from(beat, objectMapper)).toList());
  }

  public record Issue(String code, String severity, UUID visualBeatId, String message) {}

  public record Beat(
      UUID snapshotId,
      UUID visualBeatId,
      UUID sceneId,
      long beatRowVersion,
      String prompt,
      String negativePrompt,
      String characterSnapshotJson,
      String continuitySemanticHash,
      String inputFingerprint,
      List<Reference> references) {
    static Beat from(BeatSnapshot beat, ObjectMapper objectMapper) {
      return new Beat(
          beat.id(),
          beat.visualBeatId(),
          beat.sceneId(),
          beat.beatRowVersion(),
          beat.prompt(),
          beat.negativePrompt(),
          beat.characterSnapshotJson(),
          beat.continuitySemanticHash(),
          beat.inputFingerprint(),
          parseReferences(beat.referencesJson(), objectMapper));
    }
  }

  public record Reference(
      String refLabel,
      UUID assetId,
      UUID characterId,
      String canonicalName,
      String beatRole,
      String referenceRole,
      int priority,
      String contentType,
      String sha256) {}

  private static List<Reference> parseReferences(String json, ObjectMapper objectMapper) {
    try {
      Object decoded = objectMapper.readValue(json, Object.class);
      if (!(decoded instanceof List<?> values)) return List.of();
      List<Reference> result = new ArrayList<>();
      for (Object value : values) {
        if (!(value instanceof Map<?, ?> item)) continue;
        result.add(
            new Reference(
                text(item.get("refLabel")),
                uuid(item.get("assetId")),
                uuid(item.get("characterId")),
                text(item.get("canonicalName")),
                text(item.get("beatRole")),
                text(item.get("referenceRole")),
                number(item.get("priority")),
                text(item.get("contentType")),
                text(item.get("sha256"))));
      }
      return List.copyOf(result);
    } catch (Exception exception) {
      throw new IllegalStateException("Stored storyboard generation references are invalid", exception);
    }
  }

  private static String text(Object value) {
    return value == null ? null : value.toString();
  }

  private static UUID uuid(Object value) {
    return value == null ? null : UUID.fromString(value.toString());
  }

  private static int number(Object value) {
    return value instanceof Number number ? number.intValue() : Integer.parseInt(value.toString());
  }
}
