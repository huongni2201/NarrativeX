package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.port.in.PromptSettingsAccess;
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
import java.util.Set;
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
  private final com.narrativex.backend.feature.generation.application.port.out
          .VideoGenerationCatalog
      videoGenerationCatalog;
  private final NarrativeXLimitsProperties limits;
  private final com.narrativex.backend.feature.storyboard.application.port.in
          .StoryboardProductionAccess
      storyboardAccess;
  private final GenerateShotTakeUseCase shotAdmission;
  private final PromptSettingsAccess promptSettingsAccess;

  @Transactional
  public GenerationJob execute(CreateMediaJobCommand command) {
    if (!"IMAGE_MOTION".equals(command.productionMode())
        && !"VIDEO_FIRST".equals(command.productionMode())
        && !"LEGACY_IMAGE".equals(command.productionMode())) {
      throw new GenerationAdmissionDeniedException(
          "UNSUPPORTED_MEDIA_STRATEGY", "Unsupported productionMode: " + command.productionMode());
    }
    if (command.includedBeatId() != null && "VIDEO_FIRST".equals(command.productionMode())) {
      throw new GenerationAdmissionDeniedException(
          "UNSUPPORTED_MEDIA_SCOPE", "A single-VisualBeat scope is only supported for image jobs.");
    }

    String imageProvider = normalizeImageProvider(command.imageProvider());
    String idempotencyKey = requireIdempotencyKey(command.idempotencyKey());
    String requestFingerprint = fingerprint(command, imageProvider);
    String legacyRequestFingerprint = legacyFingerprint(command, imageProvider);
    generationJobRepository.acquireIdempotencyLock(idempotencyKey);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) {
      GenerationJob existingJob = existing.get();
      validateReplayScope(existingJob, command);
      var existingItems = mediaGenerationItemRepository.findByJobId(existingJob.getId());
      if (existingItems.isEmpty()
          || existingItems.stream()
              .anyMatch(
                  item -> !replayMatches(item, requestFingerprint, legacyRequestFingerprint))) {
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

    // Replay was answered above without reading prompt settings. A new operation resolves the
    // current configuration exactly once; the plan (and shot snapshots) freeze what it compiles.
    PromptSettings promptSettings = promptSettingsAccess.current();
    if (command.expectedPromptRevision() != null
        && command.expectedPromptRevision() != promptSettings.revision()) {
      throw new GenerationAdmissionDeniedException(
          "PROMPT_SETTINGS_CHANGED",
          "Prompt settings changed from revision "
              + command.expectedPromptRevision()
              + " to "
              + promptSettings.revision()
              + " after the preview; review the prompt again.");
    }

    var planningSource = mediaPlanningSourceAccess.requireCurrent(command.chapterId());
    if (command.includedBeatId() != null) {
      var beat =
          planningSource.scenes().stream()
              .flatMap(scene -> scene.beats().stream())
              .filter(candidate -> command.includedBeatId().equals(candidate.visualBeatId()))
              .findFirst()
              .orElseThrow(
                  () ->
                      new GenerationAdmissionDeniedException(
                          "VISUAL_BEAT_NOT_FOUND", "VisualBeat is not in the current chapter."));
      if (!"APPROVED".equals(beat.reviewStatus())) {
        throw new GenerationAdmissionDeniedException(
            "STORYBOARD_NOT_READY", "The VisualBeat must be approved before image generation.");
      }
    }
    boolean isVideoFirst = "VIDEO_FIRST".equals(command.productionMode());
    String providerKey;
    String modelKey;

    if (isVideoFirst) {
      providerKey = videoGenerationCatalog.defaultProvider();
      modelKey = videoGenerationCatalog.defaultModel();
    } else {
      var imageProfile = imageGenerationCatalog.resolve();
      providerKey = imageProfile.providerKey();
      modelKey = imageProfile.model();
      generationJobRepository.acquireImageCapacityLock();
      if (generationJobRepository.countActiveImageJobs()
          >= limits.getMaxConcurrentExpensiveJobs()) {
        throw new GenerationAdmissionDeniedException(
            "CAPACITY_EXHAUSTED", "Image generation capacity is exhausted.");
      }
    }

    String effectiveAspectRatio =
        isVideoFirst
            ? project.getImageAspectRatio().getCode()
            : (command.aspectRatio() != null && !command.aspectRatio().isBlank()
                ? com.narrativex.backend.feature.project.domain.enums.AspectRatio.normalize(
                    command.aspectRatio())
                : project.getImageAspectRatio().getCode());

    var plan =
        createMediaPlanUseCase.execute(
            new CreateMediaPlanCommand(
                command.projectId(),
                command.chapterId(),
                ProductionMode.valueOf(command.productionMode()),
                effectiveAspectRatio,
                providerKey,
                modelKey,
                promptSettings,
                command.includedBeatId() == null ? Set.of() : Set.of(command.includedBeatId())));

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.createChapterGeneration(
                command.projectId(),
                chapter.storyVersionId(),
                plan,
                isVideoFirst ? ResourceClass.BACKGROUND : ResourceClass.PROVIDER_BATCH,
                project.getSourceLanguage(),
                idempotencyKey));
    chapterMediaHeadRepository.setCurrent(command.chapterId(), job.getId());

    if (isVideoFirst) {
      var shotRows = storyboardAccess.findShotsByChapter(command.projectId(), command.chapterId());
      if (shotRows.isEmpty())
        throw new GenerationAdmissionDeniedException(
            "STORYBOARD_NOT_READY", "Chapter has no current shots");
      int order = 0;
      var locationContexts =
          shotAdmission.loadLocationContexts(
              command.projectId(), shotRows.stream().map(shot -> shot.id()).toList());
      for (var shot : shotRows) {
        UUID beatId =
            storyboardAccess.findSequenceById(shot.sequenceId()).orElseThrow().visualBeatId();
        var leafCommand =
            new com.narrativex.backend.feature.generation.application.command
                .GenerateShotTakeCommand(
                command.projectId(),
                shot.id(),
                null,
                null,
                null,
                null,
                "batch:" + job.getJobId() + ":shot-" + shot.id(),
                null);
        var frozen = shotAdmission.freeze(leafCommand, promptSettings, locationContexts);
        mediaGenerationItemRepository.save(
            MediaGenerationItem.createShot(
                job.getId(),
                plan.id(),
                beatId,
                shot.id(),
                order++,
                itemFingerprint(requestFingerprint, plan.id(), shot.id()),
                frozen.inputJson(),
                frozen.requestFingerprint()));
      }
      generationOutboxRepository.enqueue(job);
      return job;
    }
    String stageName = STAGE_NAME;
    stageAttemptRepository.create(StageAttempt.create(job.getId(), stageName, 1));
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
        "Created {} media job id={} planId={} beats={} provider={} model={} projectId={} chapterId={}",
        isVideoFirst ? "shot-video" : "shot-image",
        job.getId(),
        plan.id(),
        plan.scenes().stream().mapToInt(scene -> scene.beats().size()).sum(),
        providerKey,
        modelKey,
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

  /** Request identity for replay: deliberately independent of any prompt configuration. */
  static String fingerprint(CreateMediaJobCommand command, String imageProvider) {
    return hash(requestPayload(command, imageProvider));
  }

  /** Identity used before prompt settings existed; keeps replay of older jobs working. */
  static String legacyFingerprint(CreateMediaJobCommand command, String imageProvider) {
    return hash(
        requestPayload(command, imageProvider)
            + ":"
            + (command.imageStyle() == null ? "" : command.imageStyle().name()));
  }

  private static boolean replayMatches(
      MediaGenerationItem item, String requestFingerprint, String legacyRequestFingerprint) {
    UUID subject = item.getShotId() == null ? item.getVisualBeatId() : item.getShotId();
    return itemFingerprint(requestFingerprint, item.getMediaPlanId(), subject)
            .equals(item.getRequestFingerprint())
        || itemFingerprint(legacyRequestFingerprint, item.getMediaPlanId(), subject)
            .equals(item.getRequestFingerprint());
  }

  private static String requestPayload(CreateMediaJobCommand command, String imageProvider) {
    String visualMode = normalizeVisualMode(command.visualGenerationMode());
    String payload =
        String.join(
            ":",
            command.projectId().toString(),
            command.chapterId().toString(),
            command.productionMode(),
            visualMode,
            imageProvider,
            command.aspectRatio());
    return command.includedBeatId() == null
        ? payload
        : payload + ":beat:" + command.includedBeatId();
  }

  private static String hash(String payload) {
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
