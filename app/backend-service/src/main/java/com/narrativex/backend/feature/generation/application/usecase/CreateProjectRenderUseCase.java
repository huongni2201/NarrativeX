package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
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
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateProjectRenderUseCase {
  private static final String STAGE_NAME = "RENDER_PROJECT";
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

  @Transactional
  public GenerationJob execute(CreateProjectRenderCommand command) {
    String userId = currentUserId.get();
    var project = projectAccess.findOwnedProject(command.projectId(), userId);
    ProductionTimelineView timeline =
        getProductionTimelineUseCase.executeOwned(command.projectId(), userId);
    if (!timeline.readyForRender()) {
      throw new GenerationAdmissionDeniedException(
          "PROJECT_RENDER_INPUT_NOT_READY",
          "Project rendering requires READY narration and image assets for every production timeline beat.");
    }

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

    BigDecimal renderCost = estimateRenderCost(command.resolution(), timeline.totalDurationMs());
    if (command.maxAuthorizedCost() != null
        && renderCost.compareTo(command.maxAuthorizedCost()) > 0) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The requested render authorization cap is below the server estimate.");
    }

    String timelineFingerprint = timelineFingerprint(timeline);
    String idempotencyKey = idempotencyKey(command, timelineFingerprint);
    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) return existing.get();

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
                timelineFingerprint,
                null,
                project.getSourceLanguage(),
                idempotencyKey));

    projectRenderInputSnapshotRepository.create(
        job.getId(), timeline, command.resolution(), command.format());

    OperationPlan plan =
        operationPlanRepository.save(
            OperationPlan.create(
                command.projectId(),
                operationType(command.resolution(), command.format()),
                renderCost.multiply(BigDecimal.valueOf(0.8)),
                renderCost,
                command.maxAuthorizedCost() == null ? renderCost : command.maxAuthorizedCost()));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(plan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Created project render job id={} projectId={} durationMs={} chapters={} beats={}",
        job.getId(),
        command.projectId(),
        timeline.totalDurationMs(),
        timeline.chapters().size(),
        timeline.beats().size());
    return job;
  }

  static BigDecimal estimateRenderCost(String resolution, long durationMs) {
    long units = Math.max(1L, (durationMs + BILLING_WINDOW_MS - 1L) / BILLING_WINDOW_MS);
    BigDecimal unitCost =
        "1080p".equalsIgnoreCase(resolution)
            ? BigDecimal.valueOf(0.50)
            : BigDecimal.valueOf(0.25);
    return unitCost.multiply(BigDecimal.valueOf(units));
  }

  static String operationType(String resolution, String format) {
    return STAGE_NAME
        + "_"
        + resolution.toUpperCase(Locale.ROOT)
        + "_"
        + format.toUpperCase(Locale.ROOT);
  }

  private static String idempotencyKey(
      CreateProjectRenderCommand command, String timelineFingerprint) {
    if (command.idempotencyKey() != null && !command.idempotencyKey().isBlank()) {
      String normalized = command.idempotencyKey().trim();
      if (normalized.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
        throw new GenerationAdmissionDeniedException(
            "IDEMPOTENCY_CONFLICT", "Idempotency-Key must not exceed 512 characters.");
      }
      return normalized;
    }
    return "project-render:"
        + sha256(
            command.projectId()
                + ":"
                + timelineFingerprint
                + ":"
                + command.resolution()
                + ":"
                + command.format());
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
                        + beat.checksum()
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
