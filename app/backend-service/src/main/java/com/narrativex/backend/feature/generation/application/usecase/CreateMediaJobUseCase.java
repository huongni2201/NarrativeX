package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
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
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateMediaJobUseCase {
  private static final String STAGE_NAME = "CHAPTER_GENERATE";
  private static final String PRICING_VERSION = "image-mvp-2026-08-21";
  private final CurrentUserId currentUserId;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final CreateMediaPlanUseCase createMediaPlanUseCase;
  private final GenerationJobRepository generationJobRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final QuotaReservation quotaReservation;
  private final UserQuotaAccess userQuotaAccess;

  @Transactional
  public GenerationJob execute(CreateMediaJobCommand command) {
    String userId = currentUserId.get();
    if (!"IMAGE_MOTION".equals(command.productionMode())) {
      throw new GenerationAdmissionDeniedException("UNSUPPORTED_MEDIA_STRATEGY", "Only IMAGE_MOTION is available in the MVP.");
    }
    if (command.idempotencyKey() == null || command.idempotencyKey().isBlank()) {
      throw new GenerationAdmissionDeniedException("IDEMPOTENCY_CONFLICT", "Idempotency-Key is required.");
    }
    String requestFingerprint = fingerprint(command);
    generationJobRepository.acquireIdempotencyLock(command.idempotencyKey());
    var existing = generationJobRepository.findByIdempotencyKey(command.idempotencyKey());
    if (existing.isPresent()) {
      var existingItems = mediaGenerationItemRepository.findByJobOwned(userId, existing.get().getId());
      if (!existingItems.isEmpty()
          && existingItems.stream().anyMatch(item -> !requestFingerprint.equals(item.getRequestFingerprint()))) {
        throw new GenerationAdmissionDeniedException(
            "IDEMPOTENCY_CONFLICT", "The Idempotency-Key is already bound to a different request.");
      }
      return existing.get();
    }

    var chapter = chapterSourceAccess.requireOwnedForAnalysisLocked(command.projectId(), command.chapterId(), userId);
    int beatCount = mediaPlanningSourceAccess.requireCurrent(command.chapterId()).scenes().stream()
        .mapToInt(scene -> scene.beats().size()).sum();
    BigDecimal expectedCost = expectedCost(command.qualityTier(), beatCount);
    if (expectedCost.compareTo(command.maxAuthorizedCost()) > 0) {
      throw new GenerationAdmissionDeniedException("COST_LIMIT", "The requested authorization cap is below the server estimate.");
    }
    var plan = createMediaPlanUseCase.execute(new CreateMediaPlanCommand(
        command.projectId(), command.chapterId(), ProductionMode.IMAGE_MOTION, expectedCost,
        command.aspectRatio(), command.qualityTier(), "vertex", "imagen-3.0-generate-002",
        "{\"catalogVersion\":\"" + PRICING_VERSION + "\",\"tier\":\"" + command.qualityTier() + "\"}",
        sha256(PRICING_VERSION + ":" + command.qualityTier())));
    var quota = userQuotaAccess.findCurrentQuota(userId).orElseThrow(
        () -> new GenerationAdmissionDeniedException("ENTITLEMENT_DENIED", "No active plan is available."));
    var reservation = quotaReservation.reserve(userId, command.maxAuthorizedCost(), quota.maxConcurrentExpensiveJobs())
        .orElseThrow(() -> new GenerationAdmissionDeniedException("COST_LIMIT", "Media generation quota is exhausted."));

    GenerationJob job = generationJobRepository.save(GenerationJob.createChapterGeneration(
        command.projectId(), chapter.storyVersionId(), plan, ResourceClass.PROVIDER_INTERACTIVE,
        "vi-VN", command.idempotencyKey(), userId));
    OperationPlan operationPlan = operationPlanRepository.save(OperationPlan.create(
        command.projectId(), STAGE_NAME, expectedCost.multiply(new BigDecimal("0.8")),
        expectedCost.multiply(new BigDecimal("1.2")), command.maxAuthorizedCost()));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));
    var stage = stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    for (var scene : plan.scenes()) {
      for (var beat : scene.beats()) {
        String itemKey = "beat-" + beat.visualBeatId();
        mediaGenerationItemRepository.save(MediaGenerationItem.create(
            job.getId(), plan.id(), beat.visualBeatId(), itemKey, 1,
            requestFingerprint));
      }
    }
    generationOutboxRepository.enqueue(job);
    return job;
  }

  private static BigDecimal expectedCost(String qualityTier, int beatCount) {
    BigDecimal unit = switch (qualityTier) {
      case "DRAFT" -> new BigDecimal("0.10");
      case "HIGH" -> new BigDecimal("0.40");
      default -> new BigDecimal("0.25");
    };
    // The plan is created from the actual approved beat count; this is only a conservative unit cap.
    return unit.multiply(BigDecimal.valueOf(beatCount)).setScale(6, RoundingMode.HALF_UP);
  }

  private static String fingerprint(CreateMediaJobCommand command) {
    return sha256(command.projectId() + ":" + command.chapterId() + ":" + command.productionMode() + ":" + command.aspectRatio() + ":" + command.qualityTier() + ":" + command.maxAuthorizedCost().toPlainString());
  }

  private static String sha256(String value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
