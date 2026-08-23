package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.command.ConfirmChapterTranslationCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterContentVariantAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConfirmChapterTranslationUseCase {
  private static final String STAGE_NAME = "CHAPTER_TRANSLATION";
  private final CurrentUserId currentUserId;
  private final ChapterAccess chapterRepository;
  private final StoryVersionAccess storyVersionAccess;
  private final ProjectAccess projectAccess;
  private final StoryboardRevisionAccess storyboardRevisionAccess;
  private final ChapterContentVariantAccess variantRepository;
  private final GenerationJobRepository generationJobRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final QuotaReservation quotaReservation;
  private final UserQuotaAccess quotaQuery;

  @Transactional
  public GenerationJob execute(ConfirmChapterTranslationCommand command) {
    Long projectId = command.projectId();
    Long chapterId = command.chapterId();
    String userId = currentUserId.get();
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), userId);
    storyboardRevisionAccess.lockChapter(chapterId);
    chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), userId);
    var source =
        variantRepository
            .findByIdOwned(projectId, chapterId, command.sourceVariantId(), userId)
            .orElseThrow(() -> new ResourceNotFoundException("Source content variant not found"));
    if (source.type()
        != com.narrativex.backend.feature.storyboard.domain.enums.ContentVariantType.ORIGINAL) {
      throw new IllegalArgumentException("Translation source must be an ORIGINAL variant");
    }
    var currentOriginal =
        variantRepository
            .findCurrentOriginalOwned(projectId, chapterId, userId)
            .orElseThrow(
                () ->
                    new ResourceConflictException(
                        "Chapter source changed; refresh language status before translating"));
    if (!source.id().equals(currentOriginal.id())) {
      throw new ResourceConflictException(
          "Chapter source changed; refresh language status before translating");
    }
    if (!source.contentHash().equals(command.sourceContentHash())) {
      throw new ResourceConflictException(
          "Source content changed; refresh language status before translating");
    }
    var project = projectAccess.findOwnedProject(projectId, userId);
    String targetLanguage = command.targetLanguage().trim();
    if (!targetLanguage.equalsIgnoreCase(project.getProjectLanguage())) {
      throw new IllegalArgumentException("Target language must match the project language");
    }
    String normalizedTargetLanguage = targetLanguage.toLowerCase(Locale.ROOT);
    String idempotencyKey =
        "chapter-translation:"
            + chapterId
            + ":"
            + source.id()
            + ":"
            + source.contentHash()
            + ":"
            + normalizedTargetLanguage
            + ":translation-v1";
    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      log.debug(
          "Found existing translation job id={} for idempotencyKey='{}'",
          existing.get().getId(),
          idempotencyKey);
      return existing.get();
    }

    var quota =
        quotaQuery
            .findCurrentQuota(userId)
            .orElseThrow(
                () -> new GenerationAdmissionDeniedException("COST_LIMIT", "No active plan."));
    int estimatedTokens = Math.max(1, (source.content().length() + 3) / 4);
    BigDecimal maxAuthorized =
        BigDecimal.valueOf(Math.min(0.25d, 0.02d + estimatedTokens / 250_000d))
            .setScale(6, RoundingMode.UP);
    var reservation =
        quotaReservation
            .reserve(userId, maxAuthorized, quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "COST_LIMIT", "The translation quota is exhausted."));
    OperationPlan plan =
        operationPlanRepository.save(
            OperationPlan.create(
                projectId,
                "TRANSLATION",
                new BigDecimal("0.010000"),
                maxAuthorized,
                maxAuthorized.multiply(BigDecimal.valueOf(2))));
    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.createChapterTranslation(
                projectId,
                chapter.getStoryVersionId(),
                chapterId,
                source.id(),
                chapter.getRowVersion(),
                source.contentHash(),
                source.content(),
                source.languageCode(),
                project.getProjectLanguage(),
                idempotencyKey,
                userId));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(plan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Created and enqueued translation job id={} (targetLanguage='{}') for chapterId={}, projectId={}",
        job.getId(),
        targetLanguage,
        chapterId,
        projectId);
    return job;
  }
}
