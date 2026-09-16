package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.BeatLineage;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.RegenerationPlan;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.generation.application.query.RegenerationPlanView;
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

  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final ChapterContinuityRepository continuityRepository;
  private final ContinuityIssueCodec issueCodec;
  private final ImageGenerationCatalog imageGenerationCatalog;

  @Transactional
  public RegenerationPlanView execute(
      UUID projectId,
      UUID chapterId,
      UUID expectedPlanId,
      List<UUID> requestedBeatIds,
      String reason) {
    var chapter = chapterSourceAccess.requireForAnalysisLocked(projectId, chapterId);
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

    if (requestedBeatIds == null || requestedBeatIds.isEmpty()) {
      throw new IllegalArgumentException(
          "At least one visual beat id is required for regeneration.");
    }
    LinkedHashSet<UUID> requested = new LinkedHashSet<>(requestedBeatIds);

    List<BeatLineage> lineage = continuityRepository.findBeatLineage(current.planId());
    if (lineage.isEmpty()) {
      throw new GenerationAdmissionDeniedException(
          "CONTINUITY_NOT_READY", "No lineage states exist for the current continuity plan.");
    }

    Set<UUID> knownBeats =
        lineage.stream().map(BeatLineage::visualBeatId).collect(Collectors.toSet());
    if (!knownBeats.containsAll(requested)) {
      throw new ResourceConflictException("CONTINUITY_INPUT_STALE");
    }

    var issues = issueCodec.decode(current.issuesJson());
    boolean hasBlockingIssues =
        issues.stream().anyMatch(issue -> !"WARNING".equals(issue.severity()));
    if (hasBlockingIssues) {
      throw new ResourceConflictException("CONTINUITY_CONFLICT");
    }

    LinkedHashSet<UUID> affected = resolveAffected(lineage, requested);
    List<UUID> reusable =
        lineage.stream()
            .map(BeatLineage::visualBeatId)
            .filter(id -> !affected.contains(id))
            .toList();

    var imageProfile = imageGenerationCatalog.resolve();
    String normalizedReason = reason == null ? "" : reason.trim();
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
    if (replay.isPresent()) return RegenerationPlanView.from(replay.get());

    return RegenerationPlanView.from(
        continuityRepository.saveRegenerationPlan(
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
                Instant.now().plus(PLAN_TTL_MINUTES, ChronoUnit.MINUTES),
                fingerprint)));
  }

  private static LinkedHashSet<UUID> resolveAffected(
      List<BeatLineage> lineage, Set<UUID> requested) {
    Map<UUID, List<BeatLineage>> byScene =
        lineage.stream()
            .collect(
                Collectors.groupingBy(
                    BeatLineage::sceneId, java.util.LinkedHashMap::new, Collectors.toList()));
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
    String payload =
        String.join(
            ":",
            planId.toString(),
            sourceHash,
            String.join(",", requested.stream().map(UUID::toString).sorted().toList()),
            String.join(";", dependencies),
            providerKey,
            modelKey,
            reason);
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (Exception exception) {
      throw new IllegalStateException("Failed to compute regeneration plan fingerprint", exception);
    }
  }
}
