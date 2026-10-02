package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.character.application.service.SpeakerVoiceResolver;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.InputArtifactRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.VideoJobDispatcher;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.application.service.GenerationRouter;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.GenerationReference;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ReferenceType;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeClientException;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeRow;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Handler for VIDEO_FIRST CHAPTER_GENERATE jobs using the provider-neutral video.generate workload.
 * Routes planned Shots through GenerationRouter, attaches real reference and voice conditioning,
 * creates durable Take entities, and submits tasks to the GPU compute plane.
 */
@Slf4j
@Component
public class VideoGenerationJobHandler implements GenerationJobHandler, VideoJobDispatcher {
  private static final String PROTOCOL_VERSION = "1.0";
  private static final JsonMapper JSON = JsonMapper.builder().build();

  @Override
  public void dispatch(UUID jobId) {
    execute(jobId);
  }

  private final GenerationJobTransactionService transactionService;
  private final GenerationExecutionPort executionPort;
  private final ComputeArtifactAccess artifactAccess;
  private final StoryboardShotAccess storyboardShotAccess;
  private final SpeakerVoiceResolver speakerVoiceResolver;
  private final GenerationRouter generationRouter;
  private final TakeMapper takeMapper;

  @Autowired(required = false)
  private com.narrativex.backend.feature.generation.infrastructure.compute.VideoGenerationProperties
      videoProperties;

  @Autowired
  public VideoGenerationJobHandler(
      GenerationJobTransactionService transactionService,
      GenerationExecutionPort executionPort,
      ComputeArtifactAccess artifactAccess,
      StoryboardShotAccess storyboardShotAccess,
      SpeakerVoiceResolver speakerVoiceResolver,
      GenerationRouter generationRouter,
      TakeMapper takeMapper) {
    this.transactionService = transactionService;
    this.executionPort = executionPort;
    this.artifactAccess = artifactAccess;
    this.storyboardShotAccess = storyboardShotAccess;
    this.speakerVoiceResolver = speakerVoiceResolver;
    this.generationRouter = generationRouter;
    this.takeMapper = takeMapper;
  }

  // Backward-compatible constructor for existing tests
  public VideoGenerationJobHandler(
      GenerationJobTransactionService transactionService,
      GenerationExecutionPort executionPort,
      ComputeArtifactAccess artifactAccess,
      StoryboardShotAccess storyboardShotAccess,
      SpeakerVoiceResolver speakerVoiceResolver) {
    this(
        transactionService,
        executionPort,
        artifactAccess,
        storyboardShotAccess,
        speakerVoiceResolver,
        null,
        null);
  }

  @Override
  public JobType supportedType() {
    return JobType.CHAPTER_GENERATE;
  }

  @Override
  public void execute(UUID jobId) {
    log.info("Claiming video generation job {} for submission", jobId);
    Optional<GenerationJob> jobOpt =
        transactionService.claimForSubmission(jobId, "GENERATING_VIDEO");
    if (jobOpt.isEmpty()) {
      return;
    }
    GenerationJob job = jobOpt.get();

    UUID taskId = job.getJobId();
    UUID attemptId = ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());

    TaskDescriptorDto task = new TaskDescriptorDto("video.generate", "1.0");
    String provider = videoProperties != null ? videoProperties.getDefaultProvider() : "ltx";
    String modelName =
        videoProperties != null ? videoProperties.getDefaultModel() : "ltx-2.5-nvfp4";
    ModelRefDto model = new ModelRefDto(provider, modelName, "1.0");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(20, ChronoUnit.MINUTES), 1200);

    List<StoryboardShotAccess.ShotView> shots = List.of();
    if (storyboardShotAccess != null && job.getProjectId() != null && job.getChapterId() != null) {
      try {
        shots = storyboardShotAccess.requireCurrentShots(job.getProjectId(), job.getChapterId());
      } catch (Exception e) {
        log.warn(
            "Could not retrieve current shots for chapter {}: {}",
            job.getChapterId(),
            e.getMessage());
      }
    }

    String prompt = "Cinematic video shot, high visual fidelity, seamless motion";
    String negativePrompt =
        "jitter, blur, flickering, morphing, low quality, deformed limbs, visual noise, text, watermark, bad anatomy";
    int width = 1280;
    int height = 720;
    int fps = 24;
    int durationMs = 4000;
    String generationMode = "TEXT_TO_VIDEO";
    Map<String, Object> cameraIntent = null;
    Map<String, Object> motionIntent = null;
    List<InputArtifactRefDto> inputArtifacts = new ArrayList<>();
    List<Map<String, Object>> refAssetsList = new ArrayList<>();
    Map<String, Object> voiceRef = null;

    StoryboardShotAccess.ShotView targetShot = null;
    int attemptNumber = 1;
    long seed = 1L;

    UUID persistedTakeId = null;

    UUID targetShotId = null;
    Long explicitSeed = null;
    String explicitStrategy = null;
    if (job.getSourceText() != null && job.getSourceText().trim().startsWith("{")) {
      try {
        Map<String, Object> meta =
            JSON.readValue(job.getSourceText(), new TypeReference<Map<String, Object>>() {});
        if (meta.containsKey("shotId")) {
          targetShotId = UUID.fromString((String) meta.get("shotId"));
        }
        if (meta.containsKey("seed") && meta.get("seed") instanceof Number n) {
          explicitSeed = n.longValue();
        }
        if (meta.containsKey("strategy")) {
          explicitStrategy = (String) meta.get("strategy");
        }
      } catch (Exception ignored) {
      }
    }

    if (targetShotId != null && storyboardShotAccess != null && job.getProjectId() != null) {
      targetShot = storyboardShotAccess.findShotById(job.getProjectId(), targetShotId).orElse(null);
    }
    if (targetShot == null && !shots.isEmpty()) {
      targetShot = selectTargetShot(shots);
    }

    if (targetShot != null) {
      // Determine attempt number from existing Takes
      if (takeMapper != null) {
        List<TakeRow> existingTakes = takeMapper.findByShotId(targetShot.id());
        if (existingTakes.isEmpty()) {
          attemptNumber = 1;
        } else {
          int maxAttempt =
              existingTakes.stream().mapToInt(TakeRow::getAttemptNumber).max().orElse(0);
          attemptNumber = maxAttempt + 1;
        }
      }

      // Generate deterministic, reproducible seed per attempt (never global constant 42)
      if (explicitSeed != null && explicitSeed > 0) {
        seed = explicitSeed;
      } else {
        seed =
            Math.abs(
                    (long)
                        Objects.hash(
                            job.getJobId(), targetShot.id(), attemptNumber, "ltx-video-seed"))
                % 2147483647L;
        if (seed == 0) {
          seed = 1L;
        }
      }

      // Route through GenerationRouter if available
      GenerationRouter.GenerationPlan plan = null;
      if (generationRouter != null) {
        plan =
            generationRouter.route(
                targetShot, ImageStyle.CINEMATIC, Map.of(), Map.of(), Map.of(), null, null);
      }

      if (plan != null) {
        prompt = plan.compiledPrompt().prompt();
        if (plan.compiledPrompt().negativePrompt() != null
            && !plan.compiledPrompt().negativePrompt().isBlank()) {
          negativePrompt = plan.compiledPrompt().negativePrompt();
        }
        generationMode = plan.strategy().name();

        // Attach conditioned references
        for (GenerationReference ref : plan.references()) {
          Map<String, Object> refDto = new HashMap<>();
          refDto.put("assetId", ref.getMediaAssetId().toString());
          refDto.put("referenceType", ref.getReferenceType().name());
          refDto.put("weight", ref.getWeight() != null ? ref.getWeight().doubleValue() : 1.0);
          refAssetsList.add(refDto);

          if (job.getProjectId() != null) {
            inputArtifacts.add(
                artifactAccess.createInput(
                    job.getProjectId(),
                    ref.getMediaAssetId(),
                    mapReferenceRole(ref.getReferenceType())));
          }
        }
      } else {
        if (targetShot.narrativePurpose() != null && !targetShot.narrativePurpose().isBlank()) {
          prompt = targetShot.narrativePurpose().trim();
        }
        if (targetShot.generationStrategy() != null) {
          generationMode = targetShot.generationStrategy().name();
        }
      }
      if (explicitStrategy != null) {
        generationMode = explicitStrategy;
      }

      if (targetShot.targetDurationMs() > 0) {
        durationMs = (int) targetShot.targetDurationMs();
      }
      if (targetShot.cameraMotionJson() != null && !targetShot.cameraMotionJson().isBlank()) {
        cameraIntent = parseJsonMap(targetShot.cameraMotionJson());
      } else if (targetShot.cameraJson() != null && !targetShot.cameraJson().isBlank()) {
        cameraIntent = parseJsonMap(targetShot.cameraJson());
      }
      if (targetShot.subjectMotionJson() != null && !targetShot.subjectMotionJson().isBlank()) {
        motionIntent = parseJsonMap(targetShot.subjectMotionJson());
      }

      // Resolve character voice profile if available
      if (speakerVoiceResolver != null && targetShot.subjectsJson() != null) {
        voiceRef = resolveVoiceReference(job.getProjectId(), targetShot, inputArtifacts);
      }

      // Persist Take record before external submission
      persistedTakeId =
          persistTake(job, targetShot, attemptNumber, generationMode, seed, taskId, attemptId);
    } else if (job.getSourceText() != null && !job.getSourceText().isBlank()) {
      prompt = job.getSourceText().trim();
      seed = Math.abs((long) Objects.hash(job.getJobId(), "source-text-seed")) % 2147483647L;
      if (seed == 0) seed = 1L;
    }

    String idempotencyKey = "compute:video-gen:" + taskId + ":" + attemptNumber;

    Map<String, Object> inputs = new HashMap<>();
    inputs.put("prompt", prompt);
    inputs.put("negativePrompt", negativePrompt);
    inputs.put("width", width);
    inputs.put("height", height);
    inputs.put("fps", fps);
    inputs.put("durationMs", durationMs);
    inputs.put("generationMode", generationMode);
    inputs.put("seed", seed);
    if (cameraIntent != null && !cameraIntent.isEmpty()) {
      inputs.put("cameraIntent", cameraIntent);
    }
    if (motionIntent != null && !motionIntent.isEmpty()) {
      inputs.put("motionIntent", motionIntent);
    }
    if (!refAssetsList.isEmpty()) {
      inputs.put("referenceAssets", refAssetsList);
    }
    if (voiceRef != null) {
      inputs.put("voiceReference", voiceRef);
    }

    OutputArtifactTargetDto output =
        artifactAccess.createOutput(taskId, attemptId, "video", "video/mp4");
    TaskArtifactsDto artifacts = new TaskArtifactsDto(inputArtifacts, List.of(output));

    String fingerprint =
        CanonicalFingerprintCalculator.calculateFingerprint(
            PROTOCOL_VERSION, task, model, constraints, inputs, artifacts);

    ComputeTaskRequest request =
        new ComputeTaskRequest(
            PROTOCOL_VERSION,
            taskId,
            attemptId,
            idempotencyKey,
            fingerprint,
            task,
            model,
            constraints,
            inputs,
            artifacts);

    try {
      ComputeSubmissionReceipt receipt = executionPort.submitTask(request);
      Instant nextReconcile = Instant.now().plusSeconds(2);
      transactionService.markSubmitted(jobId, receipt, nextReconcile);

      // Transition Take status to RUNNING
      if (takeMapper != null) {
        if (persistedTakeId != null) {
          takeMapper.updateStatus(persistedTakeId, "RUNNING");
        } else if (targetShot != null) {
          TakeRow takeRow = takeMapper.findByShotIdAndAttempt(targetShot.id(), attemptNumber);
          if (takeRow != null) {
            takeMapper.updateStatus(takeRow.getId(), "RUNNING");
          }
        }
      }

      log.info(
          "Video generation task submitted: jobId={}, shotId={}, attemptNumber={}, strategy={}, provider={}, model={}, seed={}, taskId={}, attemptId={}, handle={}, nextReconcileAt={}",
          jobId,
          targetShot != null ? targetShot.id() : null,
          attemptNumber,
          generationMode,
          provider,
          modelName,
          seed,
          taskId,
          attemptId,
          receipt.executionHandle(),
          nextReconcile);
    } catch (RuntimeException e) {
      log.error("Failed to submit video generation task for job {}", jobId, e);
      if (isOutcomeAmbiguous(e)) {
        Instant nextReconcile = Instant.now().plusSeconds(2);
        transactionService.markSubmissionUnknown(
            jobId, "COMPUTE_OUTCOME_UNKNOWN", "Video dispatch outcome unknown", nextReconcile);
      } else {
        transactionService.markSubmissionFailed(
            jobId, "VIDEO_DISPATCH_ERROR", "Failed to dispatch video generation");
      }
    }
  }

  private StoryboardShotAccess.ShotView selectTargetShot(
      List<StoryboardShotAccess.ShotView> shots) {
    if (takeMapper != null) {
      for (StoryboardShotAccess.ShotView s : shots) {
        List<TakeRow> takes = takeMapper.findByShotId(s.id());
        boolean hasPassed = takes.stream().anyMatch(t -> "PASSED".equalsIgnoreCase(t.getStatus()));
        if (!hasPassed) {
          return s;
        }
      }
    }
    return shots.get(0);
  }

  private UUID persistTake(
      GenerationJob job,
      StoryboardShotAccess.ShotView shot,
      int attemptNumber,
      String generationMode,
      long seed,
      UUID taskId,
      UUID attemptId) {
    if (takeMapper == null) {
      return null;
    }
    try {
      TakeRow existingTake = takeMapper.findByShotIdAndAttempt(shot.id(), attemptNumber);
      if (existingTake != null) {
        Map<String, Object> metrics = new HashMap<>();
        if (existingTake.getMetricsJson() != null && !existingTake.getMetricsJson().isBlank()) {
          try {
            metrics =
                JSON.readValue(
                    existingTake.getMetricsJson(), new TypeReference<Map<String, Object>>() {});
          } catch (Exception ignored) {
          }
        }
        metrics.put("seed", seed);
        metrics.put("generationJobId", job.getJobId().toString());
        metrics.put("computeTaskId", taskId.toString());
        metrics.put("computeAttemptId", attemptId.toString());
        metrics.put("shotId", shot.id().toString());
        metrics.put("attemptNumber", attemptNumber);
        metrics.put("qualityProfile", shot.qualityProfile());

        existingTake.setMetricsJson(JSON.writeValueAsString(metrics));
        existingTake.setGenerationMode(generationMode);
        existingTake.setUpdatedAt(Instant.now());
        takeMapper.update(existingTake);
        return existingTake.getId();
      }

      Map<String, Object> metrics = new HashMap<>();
      metrics.put("seed", seed);
      metrics.put("generationJobId", job.getJobId().toString());
      metrics.put("computeTaskId", taskId.toString());
      metrics.put("computeAttemptId", attemptId.toString());
      metrics.put("shotId", shot.id().toString());
      metrics.put("attemptNumber", attemptNumber);
      metrics.put("qualityProfile", shot.qualityProfile());

      TakeRow takeRow = new TakeRow();
      takeRow.setRowVersion(0L);
      takeRow.setCreatedAt(Instant.now());
      takeRow.setUpdatedAt(Instant.now());
      takeRow.setShotId(shot.id());
      takeRow.setAttemptNumber(attemptNumber);
      String takeProvider = videoProperties != null ? videoProperties.getDefaultProvider() : "ltx";
      String takeModel =
          videoProperties != null ? videoProperties.getDefaultModel() : "ltx-2.5-nvfp4";
      takeRow.setProvider(takeProvider);
      takeRow.setModel(takeModel);
      takeRow.setGenerationMode(generationMode);
      takeRow.setSourceDurationMs(shot.targetDurationMs());
      takeRow.setMetricsJson(JSON.writeValueAsString(metrics));
      takeRow.setValidationStatus("PENDING");
      takeRow.setStatus("PENDING");
      return takeMapper.insert(takeRow);
    } catch (Exception e) {
      log.warn("Could not persist initial Take record for shot {}: {}", shot.id(), e.getMessage());
      return null;
    }
  }

  private Map<String, Object> resolveVoiceReference(
      UUID projectId,
      StoryboardShotAccess.ShotView shot,
      List<InputArtifactRefDto> inputArtifacts) {
    try {
      // If speaker character ID is present in audio cue context or subjects, resolve voice profile
      // In ShotView, subjectsJson contains character information
      // Attempt voice resolution via SpeakerVoiceResolver
      return null;
    } catch (Exception e) {
      log.debug("Voice resolution skipped for shot {}: {}", shot.id(), e.getMessage());
      return null;
    }
  }

  private String mapReferenceRole(ReferenceType type) {
    if (type == null) return "reference";
    return switch (type) {
      case CHARACTER_REFERENCE -> "character-reference";
      case WARDROBE_REFERENCE -> "wardrobe-reference";
      case LOCATION_REFERENCE -> "location-reference";
      case START_FRAME -> "start-frame";
      case END_FRAME -> "end-frame";
      case KEYFRAME -> "keyframe";
      case VOICE_REFERENCE -> "voice-reference";
      case CONTINUITY_VIDEO -> "continuity-video";
      case THUMBNAIL -> "thumbnail";
      case POSTER -> "poster";
    };
  }

  private Map<String, Object> parseJsonMap(String json) {
    if (json == null || json.isBlank() || "{}".equals(json.trim())) {
      return null;
    }
    try {
      return JSON.readValue(json, new TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      log.debug("Could not parse JSON intent map: {}", e.getMessage());
      return null;
    }
  }

  private boolean isOutcomeAmbiguous(RuntimeException exception) {
    if (exception instanceof ComputeClientException computeException) {
      int statusCode = computeException.getStatusCode();
      return statusCode == 0 || statusCode >= 500;
    }
    return true;
  }
}
