package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.BeatLineage;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.RegenerationPlan;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.generation.application.service.ContinuityIssueCodec;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateRegenerationPlanUseCase {
  private static final long PLAN_TTL_MINUTES = 15;

  private final CurrentUserId currentUserId;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final ChapterContinuityRepository continuityRepository;
  private final ContinuityIssueCodec issueCodec;
  private final ImageGenerationCatalog imageGenerationCatalog;

  @Transactional
  public RegenerationPlan execute(
      UUID projectId,
      UUID chapterId,
      UUID expectedPlanId,
      List<UUID> requestedBeatIds,
      String reason) {
    String userId = currentUserId.get();
    var chapter = chapterSourceAccess.requireOwnedForAnalysisLocked(projectId, chapterId, userId);
    var current =
        continuityRepository
            .findCurrent(projectId, chapterId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "CONTINUITY_NOT_READY", "The current storyboard has no continuity plan."));
    if (!current.planId().equals(expectedPlanId)
        || !current.sourceHash().equals(chapter.sourceHash())) {
      throw new ResourceConflictException("CONTINUITY_INPUT_STALE");
    }
    if (issueCodec.decode(current.issuesJson()).stream()
        .anyMatch(issue -> "BLOCKING".equals(issue.severity()))) {
      throw new ResourceConflictException("CONTINUITY_CONFLICT");
    }

    var lineage = continuityRepository.findBeatLineage(current.planId());
    if (lineage.isEmpty()) {
      throw new GenerationAdmissionDeniedException(
          "CONTINUITY_NOT_READY", "The current continuity plan has no beat lineage.");
    }
    LinkedHashSet<UUID> requested = new LinkedHashSet<>(requestedBeatIds);
    if (requested.isEmpty()) {
      throw new IllegalArgumentException("At least one visual beat is required for regeneration");
    }
    Set<UUID> knownBeatIds = lineage.stream().map(BeatLineage::visualBeatId).collect(Collectors.toSet());
    if (!knownBeatIds.containsAll(requested)) {
      throw new ResourceConflictException("CONTINUITY_INPUT_STALE");
    }

    LinkedHashSet<UUID> affected = resolveAffected(lineage, requested);
    List<UUID> reusable =
        lineage.stream()
            .map(BeatLineage::visualBeatId)
            .filter(id -> !affected.contains(id))
            .toList();
    var imageProfile = imageGenerationCatalog.resolve();
    var estimatedCost = imageProfile.estimateCost(affected.size());
    String normalizedReason = reason == null ? "" : reason.trim();
    if (normalizedReason.isEmpty()) throw new IllegalArgumentException("reason must not be blank");

    String fingerprint =
        fingerprint(
            current.planId(),
            current.sourceHash(),
            lineage,
            requested,
            affected,
            normalizedReason,
            imageProfile.providerKey(),
            imageProfile.model());
    var replay =
        continuityRepository.findRegenerationPlanByFingerprint(projectId, chapterId, fingerprint);
    if (replay.isPresent()) return replay.get();

    return continuityRepository.saveRegenerationPlan(
        new RegenerationPlan(
            UuidV7.random(),
            projectId,
            chapterId,
            current.planId(),
            current.sourceHash(),
            List.copyOf(requested),
            List.copyOf(affected),
            reusable,
            normalizedReason,
            estimatedCost,
            "USD",
            Instant.now().plus(PLAN_TTL_MINUTES, ChronoUnit.MINUTES),
            fingerprint,
            userId));
  }

  private static LinkedHashSet<UUID> resolveAffected(
      List<BeatLineage> lineage, Set<UUID> requested) {
    Map<UUID, List<BeatLineage>> byScene =
        lineage.stream()
            .collect(
                Collectors.groupingBy(
                    BeatLineage::sceneId,
                    java.util.LinkedHashMap::new,
                    Collectors.toList()));
    LinkedHashSet<UUID> affected = new LinkedHashSet<>();
    for (List<BeatLineage> sceneBeats : byScene.values()) {
      int firstAffectedOrder =
          sceneBeats.stream()
              .filter(beat -> requested.contains(beat.visualBeatId()))
              .mapToInt(BeatLineage::beatOrderIndex)
              .min()
              .orElse(Integer.MAX_VALUE);
      sceneBeats.stream()
          .filter(beat -> beat.beatOrderIndex() >= firstAffectedOrder)
          .sorted(Comparator.comparingInt(BeatLineage::beatOrderIndex))
          .map(BeatLineage::visualBeatId)
          .forEach(affected::add);
    }
    return affected;
  }

  private static String fingerprint(
      UUID planId,
      String sourceHash,
      List<BeatLineage> lineage,
      Set<UUID> requested,
      Set<UUID> affected,
      String reason,
      String providerKey,
      String modelKey) {
    List<String> dependencies = new ArrayList<>();
    for (BeatLineage beat : lineage) {
      if (affected.contains(beat.visualBeatId())) {
        dependencies.add(beat.visualBeatId() + "@" + beat.semanticHash());
      }
    }
    String value =
        planId
            + "|" + sourceHash
            + "|requested=" + requested
            + "|affected=" + dependencies
            + "|reason=" + reason
            + "|provider=" + providerKey
            + "|model=" + modelKey;
    try {
      return HexFormat.of()
          .formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
