package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
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
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateRegenerationJobUseCase {
  private static final String STAGE_NAME = "SHOT_IMAGE_REGENERATE";

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final ChapterContinuityRepository continuityRepository;
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
  public GenerationJob execute(
      UUID projectId,
      UUID chapterId,
      UUID regenerationPlanId,
      BigDecimal maxAuthorizedCost,
      String idempotencyHeader) {
    String userId = currentUserId.get();
    String idempotencyKey = CreateMediaJobUseCase.requireIdempotencyKey(idempotencyHeader);
    var project = projectAccess.findOwnedProject(projectId, userId);
    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      GenerationJob job = existing.get();
      boolean sameScope =
          job.getType() == JobType.CHAPTER_GENERATE
              && projectId.equals(job.getProjectId())
              && chapterId.equals(job.getChapterId())
              && continuityRepository
                  .findRegenerationPlanIdForJob(job.getId())
                  .filter(regenerationPlanId::equals)
                  .isPresent();
      if (!sameScope) {
        throw new GenerationAdmissionDeniedException(
            "IDEMPOTENCY_CONFLICT", "The Idempotency-Key is already bound to a different request.");
      }
      return job;
    }

    var chapter = chapterSourceAccess.requireOwnedForAnalysisLocked(projectId, chapterId, userId);
    var regenerationPlan =
        continuityRepository
            .findRegenerationPlan(projectId, chapterId, regenerationPlanId)
            .orElseThrow(() -> stalePlan("Regeneration plan was not found."));
    var current =
        continuityRepository
            .findCurrent(projectId, chapterId)
            .orElseThrow(() -> stalePlan("Continuity plan is no longer current."));
    if (!current.planId().equals(regenerationPlan.continuityPlanId())
        || !current.sourceHash().equals(chapter.sourceHash())
        || !regenerationPlan.sourceHash().equals(chapter.sourceHash())
        || !Instant.now().isBefore(regenerationPlan.expiresAt())) {
      throw stalePlan(
          "Continuity or source inputs changed after the regeneration plan was created.");
    }
    if (regenerationPlan.estimatedCost().compareTo(maxAuthorizedCost) > 0) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The requested authorization cap is below the regeneration estimate.");
    }

    var settings =
        continuityRepository
            .findLatestMediaSettings(chapterId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "REGENERATION_PLAN_STALE",
                        "No previous media settings are available for selective regeneration."));
    var imageProfile = imageGenerationCatalog.resolve();
    if (!imageProfile.providerKey().equals(settings.providerKey())
        || !imageProfile.model().equals(settings.modelKey())) {
      throw stalePlan("The active image provider/model changed after the previous media plan.");
    }

    var activeCurrentJob =
        chapterMediaHeadRepository
            .findCurrentJobId(chapterId)
            .flatMap(
                internalJobId -> generationJobRepository.findByIdAndOwner(internalJobId, userId))
            .filter(job -> job.getStatus().isActive());
    if (activeCurrentJob.isPresent()) {
      throw new GenerationAdmissionDeniedException(
          "MEDIA_JOB_ACTIVE", "A media generation job is already active for this chapter.");
    }

    var quota =
        userQuotaAccess
            .findCurrentQuota(userId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "ENTITLEMENT_DENIED", "No active plan is available."));
    var reservation =
        quotaReservation
            .reserve(userId, maxAuthorizedCost, quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "COST_LIMIT", "Media generation quota is exhausted."));

    var mediaPlan =
        createMediaPlanUseCase.execute(
            new CreateMediaPlanCommand(
                projectId,
                chapterId,
                ProductionMode.IMAGE_MOTION,
                regenerationPlan.estimatedCost(),
                settings.aspectRatio(),
                imageProfile.providerKey(),
                imageProfile.model(),
                imageProfile.pricingSnapshot(),
                imageProfile.pricingFingerprint(),
                ImageStyle.from(settings.imageStyle()),
                Set.copyOf(regenerationPlan.affectedBeatIds())));

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.createChapterGeneration(
                projectId,
                chapter.storyVersionId(),
                mediaPlan,
                ResourceClass.PROVIDER_BATCH,
                project.getSourceLanguage(),
                idempotencyKey,
                userId));
    continuityRepository.bindRegenerationJob(job.getId(), regenerationPlan.id());
    chapterMediaHeadRepository.setCurrent(chapterId, job.getId());

    OperationPlan operationPlan =
        operationPlanRepository.save(
            OperationPlan.create(
                projectId,
                STAGE_NAME,
                regenerationPlan.estimatedCost().multiply(new BigDecimal("0.8")),
                regenerationPlan.estimatedCost().multiply(new BigDecimal("1.2")),
                maxAuthorizedCost));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    for (var scene : mediaPlan.scenes()) {
      for (var beat : scene.beats()) {
        String itemKey = "beat-" + beat.visualBeatId();
        mediaGenerationItemRepository.save(
            MediaGenerationItem.create(
                job.getId(),
                mediaPlan.id(),
                beat.visualBeatId(),
                itemKey,
                1,
                itemFingerprint(
                    regenerationPlan.inputFingerprint(), mediaPlan.id(), beat.visualBeatId())));
      }
    }
    generationOutboxRepository.enqueue(job);
    return job;
  }

  private static GenerationAdmissionDeniedException stalePlan(String message) {
    return new GenerationAdmissionDeniedException("REGENERATION_PLAN_STALE", message);
  }

  private static String itemFingerprint(
      String regenerationFingerprint, UUID mediaPlanId, UUID visualBeatId) {
    try {
      String value = regenerationFingerprint + ":" + mediaPlanId + ":" + visualBeatId;
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
