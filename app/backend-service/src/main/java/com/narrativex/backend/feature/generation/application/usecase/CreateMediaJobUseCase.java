package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateMediaJobUseCase {
  private static final String STAGE_NAME = "SHOT_IMAGE_GENERATE";
  private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 512;
  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final CreateMediaPlanUseCase createMediaPlanUseCase;
  private final GenerationJobRepository generationJobRepository;
  private final ChapterMediaHeadRepository chapterMediaHeadRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final QuotaReservation quotaReservation;
  private final UserQuotaAccess userQuotaAccess;
  private final ImageGenerationCatalog imageGenerationCatalog;

  @Transactional
  public GenerationJob execute(CreateMediaJobCommand command) {
    String userId = currentUserId.get();
    if (!"IMAGE_MOTION".equals(command.productionMode())
        || !"IMAGE".equals(normalizeVisualMode(command.visualGenerationMode()))) {
      throw new GenerationAdmissionDeniedException(
          "UNSUPPORTED_MEDIA_STRATEGY",
          "Only IMAGE generation with IMAGE_MOTION is available in the MVP.");
    }

    String imageProvider = normalizeImageProvider(command.imageProvider());
    if ("GEMINI_WEB".equals(imageProvider)) {
      throw new GenerationAdmissionDeniedException(
          "EXTERNAL_IMAGE_PROVIDER",
          "Gemini Web generation is performed per visual beat from Storyboard and does not create an API media job.");
    }

    String idempotencyKey = requireIdempotencyKey(command.idempotencyKey());
    String requestFingerprint = fingerprint(command, imageProvider);
    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      GenerationJob existingJob = existing.get();
      validateReplayScope(existingJob, command);
      var persistedFingerprint = generationJobRepository.findRequestFingerprint(existingJob.getId());
      if (persistedFingerprint.isPresent()) {
        if (!requestFingerprint.equals(persistedFingerprint.get())) {
          throw idempotencyConflict();
        }
        return existingJob;
      }

      // Backward-compatible validation for jobs created before request_fingerprint existed.
      // We only accept and backfill when every child item proves the same request. An empty
      // legacy job cannot prove equivalence, so it must conflict rather than replay unsafely.
      var existingItems = mediaGenerationItemRepository.findByJobOwned(userId, existingJob.getId());
      if (existingItems.isEmpty()
          || existingItems.stream()
              .anyMatch(
                  item ->
                      !itemFingerprint(
                              requestFingerprint, item.getMediaPlanId(), item.getVisualBeatId())
                          .equals(item.getRequestFingerprint()))) {
        throw idempotencyConflict();
      }
      generationJobRepository.setRequestFingerprint(existingJob.getId(), requestFingerprint);
      return existingJob;
    }

    var project = projectAccess.findOwnedProject(command.projectId(), userId);
    var chapter =
        chapterSourceAccess.requireOwnedForAnalysisLocked(
            command.projectId(), command.chapterId(), userId);
    var activeCurrentJob =
        chapterMediaHeadRepository
            .findCurrentJobId(command.chapterId())
            .flatMap(internalJobId -> generationJobRepository.findByIdAndOwner(internalJobId, userId))
            .filter(job -> job.getStatus().isActive());
    if (activeCurrentJob.isPresent()) {
      throw new GenerationAdmissionDeniedException(
          "MEDIA_JOB_ACTIVE", "A media generation job is already active for this chapter.");
    }

    var planningSource = mediaPlanningSourceAccess.requireCurrent(command.chapterId());
    int beatCount = planningSource.scenes().stream().mapToInt(scene -> scene.beats().size()).sum();
    var imageProfile = imageGenerationCatalog.resolve();
    BigDecimal expectedCost = imageProfile.estimateCost(beatCount);
    if (expectedCost.compareTo(command.maxAuthorizedCost()) > 0) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The requested authorization cap is below the server estimate.");
    }
    var quota =
        userQuotaAccess
            .findCurrentQuota(userId)
            .orElseThrow(
                () -> new GenerationAdmissionDeniedException(
                    "ENTITLEMENT_DENIED", "No active plan is available."));
    var plan =
        createMediaPlanUseCase.execute(
            new CreateMediaPlanCommand(
                command.projectId(),
                command.chapterId(),
                ProductionMode.IMAGE_MOTION,
                expectedCost,
                command.aspectRatio(),
                imageProfile.providerKey(),
                imageProfile.model(),
                imageProfile.pricingSnapshot(),
                imageProfile.pricingFingerprint(),
                command.imageStyle()));
    var reservation =
        quotaReservation
            .reserve(userId, command.maxAuthorizedCost(), quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () -> new GenerationAdmissionDeniedException(
                    "COST_LIMIT", "Media generation quota is exhausted."));

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.createChapterGeneration(
                command.projectId(),
                chapter.storyVersionId(),
                plan,
                ResourceClass.PROVIDER_BATCH,
                project.getSourceLanguage(),
                idempotencyKey,
                userId));
    generationJobRepository.setRequestFingerprint(job.getId(), requestFingerprint);
    chapterMediaHeadRepository.setCurrent(command.chapterId(), job.getId());

    OperationPlan operationPlan =
        operationPlanRepository.save(
            OperationPlan.create(
                command.projectId(),
                STAGE_NAME,
                expectedCost.multiply(new BigDecimal("0.8")),
                expectedCost.multiply(new BigDecimal("1.2")),
                command.maxAuthorizedCost()));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    for (var scene : plan.scenes()) {
      for (var beat : scene.beats()) {
        String itemKey = "beat-" + beat.visualBeatId();
        mediaGenerationItemRepository.save(
            MediaGenerationItem.create(
                job.getId(),
                plan.id(),
                beat.visualBeatId(),
                itemKey,
                1,
                itemFingerprint(requestFingerprint, plan.id(), beat.visualBeatId())));
      }
    }
    generationOutboxRepository.enqueue(job);
    log.info(
        "Created shot-image media job id={} planId={} beats={} provider={} model={} estimatedCost={} projectId={} chapterId={}",
        job.getId(),
        plan.id(),
        beatCount,
        imageProfile.providerKey(),
        imageProfile.model(),
        expectedCost,
        command.projectId(),
        command.chapterId());
    return job;
  }

  static String requireIdempotencyKey(String value) {
    if (value == null || value.isBlank()) {
      throw new GenerationAdmissionDeniedException(
          "IDEMPOTENCY_CONFLICT", "Idempotency-Key is required.");
    }
    String normalized = value.trim();
    if (normalized.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new GenerationAdmissionDeniedException(
          "IDEMPOTENCY_CONFLICT", "Idempotency-Key must not exceed 512 characters.");
    }
    return normalized;
  }

  private static void validateReplayScope(GenerationJob existingJob, CreateMediaJobCommand command) {
    if (existingJob.getType() != JobType.CHAPTER_GENERATE
        || !command.projectId().equals(existingJob.getProjectId())
        || !command.chapterId().equals(existingJob.getChapterId())) {
      throw idempotencyConflict();
    }
  }

  private static GenerationAdmissionDeniedException idempotencyConflict() {
    return new GenerationAdmissionDeniedException(
        "IDEMPOTENCY_CONFLICT", "The Idempotency-Key is already bound to a different request.");
  }

  private static String normalizeVisualMode(String value) {
    return value == null || value.isBlank() ? "IMAGE" : value;
  }

  private static String normalizeImageProvider(String value) {
    if (value == null || value.isBlank()) return "API";
    if (!"API".equals(value) && !"GEMINI_WEB".equals(value)) {
      throw new GenerationAdmissionDeniedException(
          "UNSUPPORTED_MEDIA_STRATEGY", "Unsupported image generation provider: " + value);
    }
    return value;
  }

  private static String fingerprint(CreateMediaJobCommand command, String imageProvider) {
    return sha256(
        command.projectId()
            + ":" + command.chapterId()
            + ":" + command.productionMode()
            + ":" + command.aspectRatio()
            + ":" + command.imageStyle()
            + ":" + imageProvider
            + ":" + command.maxAuthorizedCost().toPlainString());
  }

  private static String itemFingerprint(
      String jobRequestFingerprint, UUID mediaPlanId, UUID visualBeatId) {
    return sha256(jobRequestFingerprint + ":" + mediaPlanId + ":" + visualBeatId);
  }

  private static String sha256(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
