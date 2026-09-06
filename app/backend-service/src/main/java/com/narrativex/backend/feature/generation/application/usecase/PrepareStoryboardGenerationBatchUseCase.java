package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.in.VisualBeatPromptContext;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.CurrentContinuity;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.BeatSnapshot;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.ChapterScope;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.GenerationBatch;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ReferenceBinding;
import com.narrativex.backend.feature.generation.application.service.VisualPromptText;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterStoryboardUseCase;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class PrepareStoryboardGenerationBatchUseCase {
  public static final String STYLE_POLICY_VERSION = "storyboard-manhwa-v2";
  public static final String PROVIDER_POLICY_VERSION = "gemini-web-3.1-pro-cinematic-v1";

  private final GetChapterStoryboardUseCase getChapterStoryboardUseCase;
  private final VisualBeatPromptContext visualBeatPromptContext;
  private final ChapterContinuityRepository chapterContinuityRepository;
  private final StoryboardGenerationSnapshotRepository snapshotRepository;
  private final ObjectMapper objectMapper;

  @Transactional(isolation = Isolation.REPEATABLE_READ)
  public PreparedBatch execute(
      UUID projectId,
      UUID chapterId,
      List<UUID> requestedBeatIds,
      UUID expectedStoryboardRevisionId,
      String idempotencyKey) {
    if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 128) {
      throw new IllegalArgumentException("Idempotency-Key is required and must be at most 128 characters");
    }
    List<UUID> beatIds = normalizeBeatIds(requestedBeatIds);
    var storyboard = getChapterStoryboardUseCase.execute(projectId, chapterId).data();
    var validBeatIds = new LinkedHashSet<UUID>();
    storyboard.scenes().forEach(
        scene -> scene.visualBeats().forEach(beat -> validBeatIds.add(beat.id())));
    if (!validBeatIds.containsAll(beatIds)) {
      throw new ResourceNotFoundException("One or more Visual Beats are not in the current Chapter storyboard");
    }

    var scope =
        snapshotRepository
            .findCurrentScope(projectId, chapterId)
            .orElseThrow(() -> new ResourceConflictException("Chapter has no current storyboard revision"));
    if (expectedStoryboardRevisionId != null
        && !expectedStoryboardRevisionId.equals(scope.storyboardRevisionId())) {
      throw new ResourceConflictException(
          "STALE_GENERATION_INPUT: current storyboard revision no longer matches the requested revision");
    }

    CurrentContinuity continuity = currentContinuity(projectId, chapterId, scope);
    List<GenerationIssue> issues = new ArrayList<>();
    if (continuity == null) {
      issues.add(
          new GenerationIssue(
              "MISSING_CONTINUITY",
              "WARNING",
              null,
              "Chapter has no current source-matching continuity plan; generation uses legacy/current canon state."));
    } else if (!"PASS".equals(continuity.reportStatus())) {
      issues.add(
          new GenerationIssue(
              "CONTINUITY_NEEDS_REVIEW",
              "WARNING",
              null,
              "Current continuity report requires review before release-quality generation."));
    }

    List<BeatSnapshot> beatSnapshots = new ArrayList<>();
    for (UUID beatId : beatIds) {
      try {
        var prepared = visualBeatPromptContext.prepare(projectId, chapterId, beatId);
        if (continuity != null && prepared.continuityPlanId() == null) {
          issues.add(
              new GenerationIssue(
                  "MISSING_CONTINUITY",
                  "BLOCKING",
                  beatId,
                  "Visual Beat is missing continuity state from the current Chapter plan."));
          continue;
        }
        beatSnapshots.add(toBeatSnapshot(scope, prepared, UuidV7.random()));
      } catch (ResourceConflictException conflict) {
        String message =
            conflict.getMessage() == null ? "Generation input conflict" : conflict.getMessage();
        issues.add(new GenerationIssue(conflictCode(message), "BLOCKING", beatId, message));
      }
    }

    String requestFingerprint = requestFingerprint(scope, continuity, beatIds, beatSnapshots);
    var existing =
        snapshotRepository.findByIdempotencyKey(projectId, chapterId, idempotencyKey.trim());
    if (existing.isPresent()) {
      if (!existing.get().requestFingerprint().equals(requestFingerprint)) {
        throw new ResourceConflictException(
            "Idempotency-Key was already used with different storyboard generation inputs");
      }
      return new PreparedBatch(
          existing.get(), parseIssues(existing.get().issuesJson()), isStale(existing.get()));
    }

    var batch =
        new GenerationBatch(
            UuidV7.random(),
            projectId,
            chapterId,
            scope.storyboardRevisionId(),
            scope.sourceHash(),
            continuity == null ? null : continuity.planId(),
            continuity == null ? null : continuity.planRevision(),
            continuity == null ? null : continuity.reportRevision(),
            STYLE_POLICY_VERSION,
            PROVIDER_POLICY_VERSION,
            idempotencyKey.trim(),
            requestFingerprint,
            writeJson(issues),
            "PREPARED",
            Instant.now(),
            beatSnapshots);
    try {
      snapshotRepository.save(batch);
      return new PreparedBatch(batch, List.copyOf(issues), false);
    } catch (DataIntegrityViolationException race) {
      var winner =
          snapshotRepository
              .findByIdempotencyKey(projectId, chapterId, idempotencyKey.trim())
              .orElseThrow(() -> race);
      if (!winner.requestFingerprint().equals(requestFingerprint)) {
        throw new ResourceConflictException(
            "Idempotency-Key was concurrently used with different storyboard generation inputs");
      }
      return new PreparedBatch(winner, parseIssues(winner.issuesJson()), isStale(winner));
    }
  }

  @Transactional(readOnly = true)
  public PreparedBatch get(UUID projectId, UUID chapterId, UUID batchId) {
    getChapterStoryboardUseCase.execute(projectId, chapterId);
    var batch =
        snapshotRepository
            .findById(projectId, chapterId, batchId)
            .orElseThrow(() -> new ResourceNotFoundException("Storyboard generation batch not found"));
    return new PreparedBatch(batch, parseIssues(batch.issuesJson()), isStale(batch));
  }

  /**
   * Recompose current inputs exclusively to compare fingerprints; callers still submit the
   * immutable prompt/reference payload stored in the batch. This catches canon, appearance,
   * wardrobe and reference changes that do not necessarily advance chapter source/storyboard IDs.
   */
  private boolean isStale(GenerationBatch batch) {
    if (!STYLE_POLICY_VERSION.equals(batch.stylePolicyVersion())
        || !PROVIDER_POLICY_VERSION.equals(batch.providerPolicyVersion())) {
      return true;
    }

    var currentScope = snapshotRepository.findCurrentScope(batch.projectId(), batch.chapterId());
    if (currentScope.isEmpty()) return true;
    ChapterScope scope = currentScope.get();
    if (!scope.storyboardRevisionId().equals(batch.storyboardRevisionId())
        || !scope.sourceHash().equals(batch.sourceHash())) {
      return true;
    }

    CurrentContinuity continuity = currentContinuity(batch.projectId(), batch.chapterId(), scope);
    if (!matchesContinuity(batch, continuity)) return true;

    for (BeatSnapshot stored : batch.beats()) {
      try {
        var prepared =
            visualBeatPromptContext.prepare(
                batch.projectId(), batch.chapterId(), stored.visualBeatId());
        BeatSnapshot current = toBeatSnapshot(scope, prepared, stored.id());
        if (!stored.inputFingerprint().equals(current.inputFingerprint())) return true;
      } catch (RuntimeException changedOrInvalid) {
        return true;
      }
    }
    return false;
  }

  private CurrentContinuity currentContinuity(
      UUID projectId, UUID chapterId, ChapterScope scope) {
    return chapterContinuityRepository
        .findCurrent(projectId, chapterId)
        .filter(current -> current.sourceHash().equals(scope.sourceHash()))
        .orElse(null);
  }

  private static boolean matchesContinuity(
      GenerationBatch batch, CurrentContinuity continuity) {
    return Objects.equals(batch.continuityPlanId(), continuity == null ? null : continuity.planId())
        && Objects.equals(
            batch.continuityPlanRevision(), continuity == null ? null : continuity.planRevision())
        && Objects.equals(
            batch.continuityReportRevision(), continuity == null ? null : continuity.reportRevision());
  }

  private BeatSnapshot toBeatSnapshot(
      ChapterScope scope,
      VisualBeatPromptContext.PreparedVisualBeatPrompt prepared,
      UUID snapshotId) {
    var composed = prepared.composedPrompt();
    boolean badChecksum =
        composed.referenceBindings().stream()
            .anyMatch(
                binding ->
                    binding.sha256() == null
                        || !binding.sha256().matches("^[0-9a-f]{64}$"));
    if (badChecksum) {
      throw new ResourceConflictException(
          "REFERENCE_INTEGRITY_FAILED: One or more required reference assets do not have a valid SHA-256 checksum.");
    }

    String referencesJson = writeJson(serializeReferences(composed.referenceBindings()));
    String finalPrompt = VisualPromptText.finalPrompt(composed);
    String beatFingerprint =
        sha256(
            scope.sourceHash()
                + "|"
                + scope.storyboardRevisionId()
                + "|"
                + nullSafe(prepared.continuityPlanId())
                + "|"
                + nullSafe(prepared.continuitySemanticHash())
                + "|"
                + STYLE_POLICY_VERSION
                + "|"
                + PROVIDER_POLICY_VERSION
                + "|"
                + prepared.visualBeatId()
                + "|"
                + prepared.beatRowVersion()
                + "|"
                + finalPrompt
                + "|"
                + composed.characterSnapshotJson()
                + "|"
                + referencesJson);
    return new BeatSnapshot(
        snapshotId,
        prepared.visualBeatId(),
        prepared.sceneId(),
        prepared.beatRowVersion(),
        finalPrompt,
        composed.negativePrompt(),
        composed.characterSnapshotJson(),
        referencesJson,
        prepared.continuitySemanticHash(),
        beatFingerprint);
  }

  private static String requestFingerprint(
      ChapterScope scope,
      CurrentContinuity continuity,
      List<UUID> requestedBeatIds,
      List<BeatSnapshot> beatSnapshots) {
    String requestedScope =
        requestedBeatIds.stream()
            .map(UUID::toString)
            .reduce("", (left, right) -> left + "|" + right);
    String acceptedInputs =
        beatSnapshots.stream()
            .map(BeatSnapshot::inputFingerprint)
            .reduce("", (left, right) -> left + "|" + right);
    return sha256(
        scope.sourceHash()
            + "|"
            + scope.storyboardRevisionId()
            + "|"
            + (continuity == null ? "" : continuity.planId())
            + "|"
            + (continuity == null ? "" : continuity.planRevision())
            + "|"
            + (continuity == null ? "" : continuity.reportRevision())
            + "|"
            + STYLE_POLICY_VERSION
            + "|"
            + PROVIDER_POLICY_VERSION
            + "|requested:"
            + requestedScope
            + "|accepted:"
            + acceptedInputs);
  }

  private static String conflictCode(String message) {
    if (message.startsWith("REFERENCE_BUDGET_EXCEEDED")) return "REFERENCE_BUDGET_EXCEEDED";
    if (message.startsWith("REFERENCE_INTEGRITY_FAILED")) return "REFERENCE_INTEGRITY_FAILED";
    if (message.startsWith("STALE_GENERATION_INPUT")) return "STALE_GENERATION_INPUT";
    return "CONTINUITY_CONFLICT";
  }

  private static List<UUID> normalizeBeatIds(List<UUID> requestedBeatIds) {
    if (requestedBeatIds == null || requestedBeatIds.isEmpty()) {
      throw new IllegalArgumentException("beatIds must not be empty");
    }
    if (requestedBeatIds.size() > 500) {
      throw new IllegalArgumentException("beatIds exceeds the supported batch size");
    }
    var unique = new LinkedHashSet<UUID>();
    for (UUID beatId : requestedBeatIds) {
      if (beatId == null) throw new IllegalArgumentException("beatIds must not contain null");
      unique.add(beatId);
    }
    return List.copyOf(unique);
  }

  private static List<Map<String, Object>> serializeReferences(List<ReferenceBinding> bindings) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (int index = 0; index < bindings.size(); index++) {
      var binding = bindings.get(index);
      Map<String, Object> value = new LinkedHashMap<>();
      value.put("refLabel", String.format("REF_%02d", index + 1));
      value.put("assetId", binding.assetId());
      value.put("characterId", binding.characterId());
      value.put("canonicalName", binding.canonicalName());
      value.put("beatRole", binding.beatRole());
      value.put("referenceRole", binding.referenceRole());
      value.put("priority", binding.priority());
      value.put("contentType", binding.contentType());
      value.put("sha256", binding.sha256());
      result.add(value);
    }
    return List.copyOf(result);
  }

  private List<GenerationIssue> parseIssues(String json) {
    try {
      return objectMapper.readValue(
          json,
          objectMapper
              .getTypeFactory()
              .constructCollectionType(List.class, GenerationIssue.class));
    } catch (Exception exception) {
      throw new IllegalStateException("Stored storyboard generation issues are invalid", exception);
    }
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not serialize storyboard generation snapshot", exception);
    }
  }

  private static String sha256(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder result = new StringBuilder(64);
      for (byte item : digest) result.append(String.format("%02x", item));
      return result.toString();
    } catch (Exception exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  private static String nullSafe(Object value) {
    return value == null ? "" : value.toString();
  }

  public record GenerationIssue(String code, String severity, UUID visualBeatId, String message) {}

  public record PreparedBatch(GenerationBatch batch, List<GenerationIssue> issues, boolean stale) {
    public boolean hasBlockingIssues() {
      return issues.stream().anyMatch(issue -> "BLOCKING".equals(issue.severity()));
    }
  }
}
