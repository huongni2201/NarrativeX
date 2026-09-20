package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
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
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final CreateMediaPlanUseCase createMediaPlanUseCase;
  private final GenerationJobRepository generationJobRepository;
  private final ChapterMediaHeadRepository chapterMediaHeadRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final ImageGenerationCatalog imageGenerationCatalog;
  private final NarrativeXLimitsProperties limits;

  @Transactional
  public GenerationJob execute(CreateMediaJobCommand command) {
    if (!"IMAGE_MOTION".equals(command.productionMode())
        && !"VIDEO_FIRST".equals(command.productionMode())
        && !"LEGACY_IMAGE".equals(command.productionMode())) {
      throw new GenerationAdmissionDeniedException(
          "UNSUPPORTED_MEDIA_STRATEGY", "Unsupported productionMode: " + command.productionMode());
    }

    String imageProvider = normalizeImageProvider(command.imageProvider());
    String idempotencyKey = requireIdempotencyKey(command.idempotencyKey());
    String requestFingerprint = fingerprint(command, imageProvider);
    generationJobRepository.acquireIdempotencyLock(idempotencyKey);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) {
      GenerationJob existingJob = existing.get();
      validateReplayScope(existingJob, command);
      var existingItems = mediaGenerationItemRepository.findByJobId(existingJob.getId());
      if (existingItems.isEmpty()
          || existingItems.stream()
              .anyMatch(
                  item ->
                      !itemFingerprint(
                              requestFingerprint, item.getMediaPlanId(), item.getVisualBeatId())
                          .equals(item.getRequestFingerprint()))) {
        throw idempotencyConflict();
      }
      return existingJob;
    }

    var project = projectAccess.findProject(command.projectId());
    var chapter =
        chapterSourceAccess.requireForAnalysisLocked(command.projectId(), command.chapterId());
    var activeCurrentJob =
        chapterMediaHeadRepository
            .findCurrentJobId(command.chapterId())
            .flatMap(generationJobRepository::findById)
            .filter(job -> job.getStatus().isActive());
    if (activeCurrentJob.isPresent()) {
      throw new GenerationAdmissionDeniedException(
          "MEDIA_JOB_ACTIVE", "A media generation job is already active for this chapter.");
    }

    var planningSource = mediaPlanningSourceAccess.requireCurrent(command.chapterId());
    int beatCount = planningSource.scenes().stream().mapToInt(scene -> scene.beats().size()).sum();
    var imageProfile = imageGenerationCatalog.resolve();
    generationJobRepository.acquireImageCapacityLock();
    if (generationJobRepository.countActiveImageJobs() >= limits.getMaxConcurrentExpensiveJobs()) {
      throw new GenerationAdmissionDeniedException(
          "CAPACITY_EXHAUSTED", "Image generation capacity is exhausted.");
    }

    var plan =
        createMediaPlanUseCase.execute(
            new CreateMediaPlanCommand(
                command.projectId(),
                command.chapterId(),
                ProductionMode.valueOf(command.productionMode()),
                command.aspectRatio(),
                imageProfile.providerKey(),
                imageProfile.model(),
                command.imageStyle()));

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.createChapterGeneration(
                command.projectId(),
                chapter.storyVersionId(),
                plan,
                ResourceClass.PROVIDER_BATCH,
                project.getSourceLanguage(),
                idempotencyKey));
    chapterMediaHeadRepository.setCurrent(command.chapterId(), job.getId());

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
        "Created shot-image media job id={} planId={} beats={} provider={} model={} projectId={} chapterId={}",
        job.getId(),
        plan.id(),
        beatCount,
        imageProfile.providerKey(),
        imageProfile.model(),
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
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key exceeds max supported length of " + MAX_IDEMPOTENCY_KEY_LENGTH + ".");
    }
    return normalized;
  }

  static String fingerprint(CreateMediaJobCommand command, String imageProvider) {
    String visualMode = normalizeVisualMode(command.visualGenerationMode());
    String payload =
        String.join(
            ":",
            command.projectId().toString(),
            command.chapterId().toString(),
            command.productionMode(),
            visualMode,
            imageProvider,
            command.aspectRatio(),
            command.imageStyle() == null ? "" : command.imageStyle().name());
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (Exception exception) {
      throw new IllegalStateException(
          "Failed to compute idempotency request fingerprint", exception);
    }
  }

  static String itemFingerprint(String requestFingerprint, UUID mediaPlanId, UUID visualBeatId) {
    String payload = requestFingerprint + ":" + mediaPlanId + ":" + visualBeatId;
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (Exception exception) {
      throw new IllegalStateException("Failed to compute item request fingerprint", exception);
    }
  }

  private static void validateReplayScope(GenerationJob job, CreateMediaJobCommand command) {
    String visualMode = normalizeVisualMode(command.visualGenerationMode());
    String imageProvider = normalizeImageProvider(command.imageProvider());
    if (job.getType() != JobType.CHAPTER_GENERATE
        || !job.getProjectId().equals(command.projectId())
        || job.getChapterId() == null
        || !job.getChapterId().equals(command.chapterId())
        || job.getProductionMode() == null
        || !job.getProductionMode().name().equals(command.productionMode())
        || (job.getAnalysisVisualGenerationMode() != null
            && !job.getAnalysisVisualGenerationMode().equals(visualMode))
        || (job.getAnalysisImageProvider() != null
            && !job.getAnalysisImageProvider().equals(imageProvider))) {
      throw idempotencyConflict();
    }
  }

  private static GenerationAdmissionDeniedException idempotencyConflict() {
    return new GenerationAdmissionDeniedException(
        "IDEMPOTENCY_CONFLICT", "Idempotency-Key is already bound to a different request payload.");
  }

  private static String normalizeVisualMode(String visualMode) {
    return visualMode == null || visualMode.isBlank() ? "IMAGE" : visualMode.trim();
  }

  private static String normalizeImageProvider(String provider) {
    return provider == null || provider.isBlank() ? "API" : provider.trim();
  }
}
