package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.InputArtifactRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.VideoJobDispatcher;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeClientException;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeRow;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Handler for VIDEO_FIRST CHAPTER_GENERATE jobs using the provider-neutral video.generate workload.
 * Submits only admitted, frozen Take snapshots to the GPU compute plane; any job without one fails
 * closed instead of falling back to a default prompt.
 */
@Slf4j
@Component
public class VideoGenerationJobHandler implements GenerationJobHandler, VideoJobDispatcher {
  private static final String PROTOCOL_VERSION = "1.0";
  private static final Set<String> SCHEMA_1_1_REQUIRED_INPUTS =
      Set.of(
          "workflowProfileId",
          "audioMode",
          "prompt",
          "negativePrompt",
          "width",
          "height",
          "fps",
          "durationMs",
          "generationMode",
          "seed");
  private static final Set<String> SCHEMA_1_1_ALLOWED_INPUTS =
      Set.of(
          "workflowProfileId",
          "audioMode",
          "prompt",
          "negativePrompt",
          "width",
          "height",
          "fps",
          "durationMs",
          "generationMode",
          "seed",
          "dialogue",
          "voiceReference",
          "cameraIntent",
          "motionIntent");
  private static final Pattern STRUCTURED_INPUT_HEADER =
      Pattern.compile("^\\s*\\{\\s*\\\"(?:schemaVersion|shotId)\\\"\\s*:");
  private static final JsonMapper JSON = JsonMapper.builder().build();

  @Override
  public void dispatch(UUID jobId) {
    execute(jobId);
  }

  private final GenerationJobTransactionService transactionService;
  private final GenerationExecutionPort executionPort;
  private final ComputeArtifactAccess artifactAccess;
  private final TakeMapper takeMapper;

  @Autowired
  public VideoGenerationJobHandler(
      GenerationJobTransactionService transactionService,
      GenerationExecutionPort executionPort,
      ComputeArtifactAccess artifactAccess,
      TakeMapper takeMapper) {
    this.transactionService = transactionService;
    this.executionPort = executionPort;
    this.artifactAccess = artifactAccess;
    this.takeMapper = takeMapper;
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

    JsonNode sourceInput;
    try {
      sourceInput = readJobInput(job.getSourceText());
    } catch (IllegalArgumentException exception) {
      transactionService.markSubmissionFailed(
          jobId, "VIDEO_DISPATCH_ERROR", "Malformed persisted video input");
      return;
    }
    if (sourceInput != null && sourceInput.isObject() && sourceInput.has("schemaVersion")) {
      executeFrozen(job);
      return;
    }

    // Only admitted, frozen Take snapshots may reach the GPU. A job without one never passed
    // preflight, cue ownership or duration admission, so it must not fall back to a default prompt.
    transactionService.markSubmissionFailed(
        jobId, "VIDEO_LEGACY_INTENT_UNSUPPORTED", "Video job has no admitted Take snapshot");
  }

  private void executeFrozen(GenerationJob job) {
    boolean submissionStarted = false;
    try {
      var snapshot =
          JSON.readValue(
              job.getSourceText(),
              com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot.class);
      if (snapshot.schemaVersion() != 1)
        throw new IllegalArgumentException("Unsupported Take snapshot version");
      if (takeMapper == null) throw new IllegalStateException("Durable take storage unavailable");
      TakeRow take = takeMapper.findByGenerationJobId(job.getId());
      if (take == null
          || !snapshot.inputFingerprint().equals(take.getInputFingerprint())
          || !JSON.readTree(job.getSourceText())
              .equals(JSON.readTree(take.getInputSnapshotJson()))) {
        throw new IllegalStateException("Frozen take intent is missing or inconsistent");
      }
      String schemaVersion = "1.0";
      if (snapshot.workflowRevision() != null && snapshot.workflowRevision().contains(":")) {
        schemaVersion = snapshot.workflowRevision().split(":")[1];
      }
      validateFrozenInputs(snapshot, schemaVersion);
      List<InputArtifactRefDto> inputs = new ArrayList<>();
      for (var ref : snapshot.references()) {
        var artifact = artifactAccess.createInput(job.getProjectId(), ref.assetId(), ref.role());
        if (!ref.sha256().equals(artifact.sha256()) || ref.sizeBytes() != artifact.sizeBytes()) {
          throw new IllegalStateException("Frozen reference integrity changed");
        }
        inputs.add(artifact);
      }
      UUID outputId =
          UUID.nameUUIDFromBytes(
              (take.getComputeAttemptId() + ":video")
                  .getBytes(java.nio.charset.StandardCharsets.UTF_8));
      var output =
          artifactAccess.getOrCreateTarget(
              take.getComputeTaskId(), take.getComputeAttemptId(), outputId, "video", "video/mp4");
      var task = new TaskDescriptorDto("video.generate", schemaVersion);
      var model = new ModelRefDto(snapshot.provider(), snapshot.model(), snapshot.modelRevision());
      var constraints = new TaskConstraintsDto(snapshot.deadline(), 1200);
      var artifacts = new TaskArtifactsDto(inputs, List.of(output));
      var workerInputs = new HashMap<>(snapshot.inputs());
      if ("1.0".equals(schemaVersion) && !snapshot.references().isEmpty()) {
        workerInputs.put(
            "referenceAssets",
            snapshot.references().stream()
                .map(
                    r ->
                        Map.of(
                            "assetId",
                            r.assetId().toString(),
                            "referenceType",
                            r.role().replace('-', '_').toUpperCase(),
                            "weight",
                            r.weight()))
                .toList());
      }
      var request =
          new ComputeTaskRequest(
              PROTOCOL_VERSION,
              take.getComputeTaskId(),
              take.getComputeAttemptId(),
              "compute:shot-take:" + take.getComputeAttemptId(),
              CanonicalFingerprintCalculator.calculateFingerprint(
                  PROTOCOL_VERSION, task, model, constraints, workerInputs, artifacts),
              task,
              model,
              constraints,
              workerInputs,
              artifacts);
      submissionStarted = true;
      var receipt = executionPort.submitTask(request);
      transactionService.markSubmitted(job.getJobId(), receipt, Instant.now().plusSeconds(2));
      takeMapper.updateStatus(take.getId(), "RUNNING");
      takeMapper.refreshShotStatus(take.getId());
    } catch (RuntimeException e) {
      if (submissionStarted && isOutcomeAmbiguous(e)) {
        transactionService.markSubmissionUnknown(
            job.getJobId(),
            "COMPUTE_OUTCOME_UNKNOWN",
            "Video dispatch outcome unknown",
            Instant.now().plusSeconds(2));
      } else {
        transactionService.markSubmissionFailed(
            job.getJobId(), "VIDEO_DISPATCH_ERROR", "Failed to dispatch frozen video inputs");
      }
    }
  }

  private static void validateFrozenInputs(
      com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot snapshot,
      String schemaVersion) {
    if (!"1.1".equals(schemaVersion)) return;
    var inputs = snapshot.inputs();
    if (!"LTX_NATIVE_AV".equals(snapshot.audioMode())
        || inputs == null
        || !"NATIVE_AV".equals(inputs.get("audioMode"))
        || !inputs.keySet().containsAll(SCHEMA_1_1_REQUIRED_INPUTS)
        || !SCHEMA_1_1_ALLOWED_INPUTS.containsAll(inputs.keySet())) {
      throw new IllegalArgumentException(
          "Frozen video.generate 1.1 inputs are incomplete or invalid");
    }
  }

  private static JsonNode readJobInput(String source) {
    if (source == null || source.isBlank()) return null;
    try {
      return JSON.readTree(source);
    } catch (RuntimeException ignored) {
      if (STRUCTURED_INPUT_HEADER.matcher(source).find()) {
        throw new IllegalArgumentException("Malformed persisted video input");
      }
      // Legacy source text is ordinary story data, not necessarily JSON intent.
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
