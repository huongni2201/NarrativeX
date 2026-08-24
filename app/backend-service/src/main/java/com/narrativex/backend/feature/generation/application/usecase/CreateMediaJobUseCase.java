package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
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
  private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 200;
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
    if (!"IMAGE_MOTION".equals(command.productionMode())) {
      throw new GenerationAdmissionDeniedException(
          "UNSUPPORTED_MEDIA_STRATEGY", "Only IMAGE_MOTION is available in the MVP.");
    }
    String idempotencyKey = requireIdempotencyKey(command.idempotencyKey());
    String requestFingerprint = fingerprint(command);
    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      var existingItems =
          mediaGenerationItemRepository.findByJobOwned(userId, existing.get().getId());
      if (!existingItems.isEmpty()
          && existingItems.stream()
              .anyMatch(
                  item ->
                      !itemFingerprint(
                              requestFingerprint, item.getMediaPlanId(), item.getVisualBeatId())
                          .equals(item.getRequestFingerprint()))) {
        throw new GenerationAdmissionDeniedException(
            "IDEMPOTENCY_CONFLICT", "The Idempotency-Key is already bound to a different request.");
      }
      log.debug(
          "Found existing media generation job id={} for idempotencyKey='{}'",
          existing.get().getId(),
          idempotencyKey);
      return existing.get();
    }

    var project = projectAccess.findOwnedProject(command.projectId(), userId);
    var chapter =
        chapterSourceAccess.requireOwnedForAnalysisLocked(
            command.projectId(), command.chapterId(), userId);
    int beatCount =
        mediaPlanningSourceAccess.requireCurrent(command.chapterId()).scenes().stream()
            .mapToInt(scene -> scene.beats().size())
            .sum();
    var imageProfile = imageGenerationCatalog.resolve(command.qualityTier());
    BigDecimal expectedCost = imageProfile.estimateCost(beatCount);
    if (expectedCost.compareTo(command.maxAuthorizedCost()) > 0) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The requested authorization cap is below the server estimate.");
    }
    var quota =
        userQuotaAccess
            .findCurrentQuota(userId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "ENTITLEMENT_DENIED", "No active plan is available."));
    if (!qualityAllowed(command.qualityTier(), quota.maxVideoQuality())) {
      throw new GenerationAdmissionDeniedException(
          "ENTITLEMENT_DENIED", "The requested quality exceeds the active plan entitlement.");
    }
    var plan =
        createMediaPlanUseCase.execute(
            new CreateMediaPlanCommand(
                command.projectId(),
                command.chapterId(),
                ProductionMode.IMAGE_MOTION,
                expectedCost,
                command.aspectRatio(),
                command.qualityTier(),
                imageProfile.providerKey(),
                imageProfile.model(),
                imageProfile.pricingSnapshot(),
                imageProfile.pricingFingerprint(),
                command.imageStyle()));
    var reservation =
        quotaReservation
            .reserve(userId, command.maxAuthorizedCost(), quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
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
        String shotFingerprint =
            itemFingerprint(requestFingerprint, plan.id(), beat.visualBeatId());
        mediaGenerationItemRepository.save(
            MediaGenerationItem.create(
                job.getId(), plan.id(), beat.visualBeatId(), itemKey, 1, shotFingerprint));
      }
    }
    generationOutboxRepository.enqueue(job);
    log.info(
        "Created and enqueued shot-image media job id={} (planId={}, beats={}, quality='{}', model='{}', estimatedCost={}) for projectId={}, chapterId={}",
        job.getId(),
        plan.id(),
        beatCount,
        command.qualityTier(),
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
          "IDEMPOTENCY_CONFLICT", "Idempotency-Key must not exceed 200 characters.");
    }
    return normalized;
  }

  private static String fingerprint(CreateMediaJobCommand command) {
    return sha256(
        command.projectId()
            + ":"
            + command.chapterId()
            + ":"
            + command.productionMode()
            + ":"
            + command.aspectRatio()
            + ":"
            + command.qualityTier()
            + ":"
            + command.imageStyle()
            + ":"
            + command.maxAuthorizedCost().toPlainString());
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

  private static boolean qualityAllowed(String requested, String maximum) {
    if (maximum == null || maximum.isBlank()) return false;
    return qualityRank(requested) <= qualityRank(maximum);
  }

  private static int qualityRank(String value) {
    return switch (value == null ? "" : value.toUpperCase()) {
      case "DRAFT", "720P" -> 1;
      case "STANDARD" -> 2;
      case "HIGH", "1080P" -> 3;
      case "ULTRA" -> 4;
      default -> 0;
    };
  }
}
