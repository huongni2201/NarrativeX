package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.ProjectRenderInputSnapshotRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.RenderExecutionTarget;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateProjectRenderUseCase {
  private static final String CLOUD_STAGE_NAME = "RENDER_PROJECT";
  private static final String LOCAL_STAGE_NAME = "RENDER_PROJECT_LOCAL";
  private static final String PROJECT_RENDER_CAPABILITY = "PROJECT_RENDER";
  private static final long BILLING_WINDOW_MS = 30L * 60L * 1000L;
  private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 512;

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final GetProductionTimelineUseCase getProductionTimelineUseCase;
  private final GenerationJobRepository generationJobRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final ProjectRenderInputSnapshotRepository projectRenderInputSnapshotRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final QuotaReservation quotaReservation;
  private final UserQuotaAccess userQuotaAccess;
  private final LocalDeviceAccess localDeviceAccess;

  @Transactional
  public GenerationJob execute(CreateProjectRenderCommand command) {
    String userId = currentUserId.get();
    var project = projectAccess.findOwnedProject(command.projectId(), userId);
    RenderExecutionTarget executionTarget = command.executionTarget();
    validateExecutionTarget(userId, executionTarget, command.localDeviceId());

    ProductionTimelineView sourceTimeline =
        getProductionTimelineUseCase.executeOwned(command.projectId(), userId);
    if (!sourceTimeline.readyForRender()) {
      throw new GenerationAdmissionDeniedException(
          "PROJECT_RENDER_INPUT_NOT_READY",
          "Project rendering requires READY narration and visual media for every production timeline beat.");
    }
    validateMediaForExecutionTarget(sourceTimeline, executionTarget);
    ProductionTimelineView timeline = applyBeatOverrides(sourceTimeline, command.beatOverrides());

    var quota =
        userQuotaAccess
            .findCurrentQuota(userId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "ENTITLEMENT_DENIED", "No active plan."));
    if (!qualityAllowed(command.resolution(), quota.maxVideoQuality())) {
      throw new GenerationAdmissionDeniedException(
          "ENTITLEMENT_DENIED", "The requested resolution exceeds the active plan entitlement.");
    }

    BigDecimal renderCost =
        executionTarget == RenderExecutionTarget.LOCAL_DEVICE
            ? BigDecimal.ZERO
            : estimateRenderCost(command.resolution(), timeline.totalDurationMs());
    if (command.maxAuthorizedCost() != null
        && renderCost.compareTo(command.maxAuthorizedCost()) > 0) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The requested render authorization cap is below the server estimate.");
    }

    String timelineFingerprint = timelineFingerprint(timeline);
    String requestFingerprint = requestFingerprint(command, timelineFingerprint);
    String idempotencyKey = idempotencyKey(command, requestFingerprint);
    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      GenerationJob existingJob = existing.get();
      if (existingJob.getType() != JobType.RENDER_PROJECT
          || !requestFingerprint.equals(existingJob.getSourceHash())) {
        throw new GenerationAdmissionDeniedException(
            "IDEMPOTENCY_CONFLICT",
            "Idempotency-Key is already bound to a different project render request.");
      }
      return existingJob;
    }

    var reservation =
        quotaReservation
            .reserve(userId, renderCost, quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "COST_LIMIT", "Project render quota is exhausted."));

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.rehydrate(
                null,
                0L,
                UuidV7.random(),
                command.projectId(),
                JobType.RENDER_PROJECT,
                JobStatus.QUEUED,
                ResourceClass.CPU_RENDER,
                0,
                "QUEUED",
                null,
                userId,
                userId,
                timeline.storyVersionId(),
                null,
                null,
                null,
                requestFingerprint,
                null,
                project.getSourceLanguage(),
                idempotencyKey));

    projectRenderInputSnapshotRepository.create(
        job.getId(),
        timeline,
        command.resolution(),
        command.format(),
        executionTarget,
        command.localDeviceId());

    OperationPlan plan =
        operationPlanRepository.save(
            OperationPlan.create(
                command.projectId(),
                operationType(executionTarget, command.resolution(), command.format()),
                renderCost.multiply(BigDecimal.valueOf(0.8)),
                renderCost,
                command.maxAuthorizedCost() == null ? renderCost : command.maxAuthorizedCost()));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(plan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), stageName(executionTarget), 1));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Created project render job id={} projectId={} target={} deviceId={} durationMs={} chapters={} beats={} overrides={}",
        job.getId(),
        command.projectId(),
        executionTarget,
        command.localDeviceId(),
        timeline.totalDurationMs(),
        timeline.chapters().size(),
        timeline.beats().size(),
        command.beatOverrides().size());
    return job;
  }

  private static void validateMediaForExecutionTarget(
      ProductionTimelineView timeline, RenderExecutionTarget executionTarget) {
    if (executionTarget != RenderExecutionTarget.CLOUD) return;
    if (timeline.beats().stream().anyMatch(beat -> "LOCAL_ONLY".equals(beat.storageMode()))) {
      throw new GenerationAdmissionDeniedException(
          "CLOUD_RENDER_LOCAL_MEDIA",
          "Cloud rendering cannot use LOCAL_ONLY beat media. Render on the paired Desktop or upload the asset first.");
    }
    if (timeline.beats().stream().anyMatch(beat -> "VIDEO".equals(beat.mediaType()))) {
      throw new GenerationAdmissionDeniedException(
          "CLOUD_VIDEO_MEDIA_UNSUPPORTED",
          "Uploaded video beats currently require LOCAL_DEVICE rendering.");
    }
  }

  private void validateExecutionTarget(
      String userId, RenderExecutionTarget executionTarget, UUID localDeviceId) {
    if (executionTarget == RenderExecutionTarget.CLOUD) {
      if (localDeviceId != null) {
        throw new GenerationAdmissionDeniedException(
            "INVALID_RENDER_EXECUTION_TARGET",
            "CLOUD project render must not specify a local device.");
      }
      return;
    }
    if (localDeviceId == null) {
      throw new GenerationAdmissionDeniedException(
          "LOCAL_DEVICE_REQUIRED", "LOCAL_DEVICE project render requires a paired desktop device.");
    }
    try {
      localDeviceAccess.requireEligibleOwnedDevice(userId, localDeviceId, PROJECT_RENDER_CAPABILITY);
    } catch (IllegalArgumentException | IllegalStateException exception) {
      throw new GenerationAdmissionDeniedException("LOCAL_DEVICE_UNAVAILABLE", exception.getMessage());
    }
  }

  static ProductionTimelineView applyBeatOverrides(
      ProductionTimelineView timeline, List<RenderBeatOverride> overrides) {
    if (overrides == null || overrides.isEmpty()) return timeline;

    Set<UUID> seen = new HashSet<>();
    Map<UUID, RenderBeatOverride> overrideByBeat = new LinkedHashMap<>();
    for (RenderBeatOverride override : overrides) {
      if (!seen.add(override.visualBeatId())) {
        throw new GenerationAdmissionDeniedException(
            "INVALID_RENDER_OVERRIDE", "Each visual beat may have at most one render override.");
      }
      overrideByBeat.put(override.visualBeatId(), override);
    }

    Set<UUID> timelineBeatIds =
        timeline.beats().stream()
            .map(ProductionTimelineView.Beat::visualBeatId)
            .collect(Collectors.toSet());
    UUID unknownBeat =
        overrideByBeat.keySet().stream()
            .filter(id -> !timelineBeatIds.contains(id))
            .findFirst()
            .orElse(null);
    if (unknownBeat != null) {
      throw new GenerationAdmissionDeniedException(
          "INVALID_RENDER_OVERRIDE",
          "Render override references a visual beat outside the current production timeline.");
    }

    List<ProductionTimelineView.Beat> adjustedBeats = new ArrayList<>(timeline.beats().size());
    for (ProductionTimelineView.Chapter chapter : timeline.chapters()) {
      List<ProductionTimelineView.Beat> chapterBeats =
          timeline.beats().stream()
              .filter(beat -> beat.chapterId().equals(chapter.chapterId()))
              .toList();
      if (chapterBeats.isEmpty()) continue;

      long chapterDurationMs = chapter.endMs() - chapter.startMs();
      if (chapterDurationMs < chapterBeats.size()) {
        throw new GenerationAdmissionDeniedException(
            "INVALID_RENDER_OVERRIDE", "Chapter audio is too short for its visual beat count.");
      }

      long[] weights = new long[chapterBeats.size()];
      long totalWeight = 0L;
      for (int index = 0; index < chapterBeats.size(); index++) {
        ProductionTimelineView.Beat beat = chapterBeats.get(index);
        RenderBeatOverride override = overrideByBeat.get(beat.visualBeatId());
        long weight =
            override != null && override.durationMs() != null ? override.durationMs() : beat.durationMs();
        weights[index] = weight;
        totalWeight = Math.addExact(totalWeight, weight);
      }

      long previousRelativeEnd = 0L;
      long cumulativeWeight = 0L;
      for (int index = 0; index < chapterBeats.size(); index++) {
        ProductionTimelineView.Beat beat = chapterBeats.get(index);
        RenderBeatOverride override = overrideByBeat.get(beat.visualBeatId());
        cumulativeWeight = Math.addExact(cumulativeWeight, weights[index]);

        long relativeEnd;
        if (index == chapterBeats.size() - 1) {
          relativeEnd = chapterDurationMs;
        } else {
          relativeEnd = Math.round((double) chapterDurationMs * cumulativeWeight / totalWeight);
          long minimumEnd = previousRelativeEnd + 1L;
          long latestEnd = chapterDurationMs - (chapterBeats.size() - index - 1L);
          relativeEnd = Math.max(minimumEnd, Math.min(relativeEnd, latestEnd));
        }

        long startMs = Math.addExact(chapter.startMs(), previousRelativeEnd);
        long endMs = Math.addExact(chapter.startMs(), relativeEnd);
        String cameraMovement =
            override != null && override.cameraMovement() != null
                ? override.cameraMovement()
                : beat.cameraMovement();
        adjustedBeats.add(
            new ProductionTimelineView.Beat(
                beat.chapterId(),
                beat.chapterOrderIndex(),
                beat.sceneIndex(),
                beat.beatIndex(),
                beat.visualBeatId(),
                beat.title(),
                beat.visualIntent(),
                cameraMovement,
                beat.assetStrategy(),
                beat.mediaAssetId(),
                beat.mediaType(),
                beat.storageMode(),
                beat.sourceDurationMs(),
                beat.fitMode(),
                beat.trimStartMs(),
                beat.mediaSelectionActive(),
                beat.storageKey(),
                beat.sizeBytes(),
                beat.checksum(),
                startMs,
                endMs,
                endMs - startMs,
                beat.assetReady()));
        previousRelativeEnd = relativeEnd;
      }
    }

    if (adjustedBeats.size() != timeline.beats().size()) {
      throw new GenerationAdmissionDeniedException(
          "INVALID_RENDER_OVERRIDE", "Production timeline contains beats outside its chapter set.");
    }
    return new ProductionTimelineView(
        timeline.projectId(),
        timeline.storyVersionId(),
        timeline.totalDurationMs(),
        timeline.aspectRatio(),
        timeline.readyForRender(),
        timeline.chapters(),
        List.copyOf(adjustedBeats));
  }

  static BigDecimal estimateRenderCost(String resolution, long durationMs) {
    long units = Math.max(1L, (durationMs + BILLING_WINDOW_MS - 1L) / BILLING_WINDOW_MS);
    BigDecimal unitCost =
        "1080p".equalsIgnoreCase(resolution) ? BigDecimal.valueOf(0.50) : BigDecimal.valueOf(0.25);
    return unitCost.multiply(BigDecimal.valueOf(units));
  }

  static String operationType(String resolution, String format) {
    return operationType(RenderExecutionTarget.CLOUD, resolution, format);
  }

  static String operationType(
      RenderExecutionTarget executionTarget, String resolution, String format) {
    return stageName(executionTarget)
        + "_"
        + resolution.toUpperCase(Locale.ROOT)
        + "_"
        + format.toUpperCase(Locale.ROOT);
  }

  static String requestFingerprint(CreateProjectRenderCommand command, String timelineFingerprint) {
    return sha256(
        command.projectId()
            + ":"
            + timelineFingerprint
            + ":"
            + command.resolution().toLowerCase(Locale.ROOT)
            + ":"
            + command.format().toLowerCase(Locale.ROOT)
            + ":"
            + command.executionTarget().name()
            + ":"
            + (command.localDeviceId() == null ? "-" : command.localDeviceId()));
  }

  private static String idempotencyKey(
      CreateProjectRenderCommand command, String requestFingerprint) {
    if (command.idempotencyKey() != null && !command.idempotencyKey().isBlank()) {
      String normalized = command.idempotencyKey().trim();
      if (normalized.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
        throw new GenerationAdmissionDeniedException(
            "IDEMPOTENCY_CONFLICT", "Idempotency-Key must not exceed 512 characters.");
      }
      return normalized;
    }
    return "project-render:" + requestFingerprint;
  }

  static String timelineFingerprint(ProductionTimelineView timeline) {
    String chapters =
        timeline.chapters().stream()
            .map(
                chapter ->
                    chapter.chapterId()
                        + ":"
                        + chapter.rowVersion()
                        + ":"
                        + chapter.sourceHash()
                        + ":"
                        + chapter.mediaPlanId()
                        + ":"
                        + chapter.mediaPlanRevision()
                        + ":"
                        + chapter.audioChecksum()
                        + ":"
                        + chapter.startMs()
                        + ":"
                        + chapter.endMs())
            .collect(Collectors.joining("|"));
    String beats =
        timeline.beats().stream()
            .map(
                beat ->
                    beat.visualBeatId()
                        + ":"
                        + beat.mediaAssetId()
                        + ":"
                        + beat.mediaType()
                        + ":"
                        + beat.storageMode()
                        + ":"
                        + beat.checksum()
                        + ":"
                        + beat.sourceDurationMs()
                        + ":"
                        + beat.fitMode()
                        + ":"
                        + beat.trimStartMs()
                        + ":"
                        + beat.startMs()
                        + ":"
                        + beat.endMs()
                        + ":"
                        + beat.cameraMovement())
            .collect(Collectors.joining("|"));
    return sha256(
        timeline.projectId()
            + ":"
            + timeline.storyVersionId()
            + ":"
            + timeline.aspectRatio()
            + ":"
            + timeline.totalDurationMs()
            + ":"
            + chapters
            + ":"
            + beats);
  }

  private static String stageName(RenderExecutionTarget executionTarget) {
    return executionTarget == RenderExecutionTarget.LOCAL_DEVICE ? LOCAL_STAGE_NAME : CLOUD_STAGE_NAME;
  }

  private static String sha256(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }

  private static boolean qualityAllowed(String requestedResolution, String maximumQuality) {
    if (maximumQuality == null || maximumQuality.isBlank()) return false;
    int requested = "1080p".equalsIgnoreCase(requestedResolution) ? 3 : 1;
    int maximum =
        switch (maximumQuality.toUpperCase(Locale.ROOT)) {
          case "DRAFT", "720P" -> 1;
          case "STANDARD" -> 2;
          case "HIGH", "1080P" -> 3;
          case "ULTRA" -> 4;
          default -> 0;
        };
    return maximum >= requested;
  }
}
