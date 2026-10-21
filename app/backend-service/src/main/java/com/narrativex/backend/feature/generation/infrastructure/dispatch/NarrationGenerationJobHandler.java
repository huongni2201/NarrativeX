package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.catalog.application.port.in.VoiceCatalogAccess;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
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
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.application.service.NarrationAlignmentAdmission;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.NarrationRequest;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeClientException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Handler for NARRATION_GENERATE (audio TTS) jobs. Submits task to GPU compute plane and
 * immediately records SUBMITTED without blocking.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NarrationGenerationJobHandler implements GenerationJobHandler {
  private static final String PROTOCOL_VERSION = "1.0";
  private static final String VOICE_REFERENCE_ROLE = "voice-reference";
  private static final String ALIGN_ROLE = "source-audio";

  private final GenerationJobTransactionService transactionService;
  private final GenerationExecutionPort executionPort;
  private final ComputeArtifactAccess artifactAccess;
  private final NarrationRequestRepository narrationRequestRepository;
  private final VoiceCatalogAccess voiceCatalogAccess;

  @Override
  public JobType supportedType() {
    return JobType.NARRATION_GENERATE;
  }

  @Override
  public void execute(UUID jobId) {
    log.info("Claiming narration generation job {} for submission", jobId);
    Optional<GenerationJob> jobOpt =
        transactionService.claimForSubmission(jobId, "GENERATING_NARRATION");
    if (jobOpt.isEmpty()) {
      return;
    }
    GenerationJob job = jobOpt.get();

    if (NarrationAlignmentAdmission.isAlignmentJob(job)) {
      submitAlignment(job);
      return;
    }

    UUID taskId = job.getJobId();
    UUID attemptId = ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());
    String idempotencyKey = "compute:tts:" + taskId;

    VoiceInput voiceInput;
    try {
      voiceInput = resolveVoice(job);
    } catch (RuntimeException e) {
      log.error("Narration voice could not be resolved for job {}", jobId, e);
      transactionService.markSubmissionFailed(
          jobId, "NARRATION_VOICE_UNRESOLVED", "Narration voice could not be resolved");
      return;
    }

    TaskDescriptorDto task = new TaskDescriptorDto("audio.synthesize", "1.0");
    ModelRefDto model = new ModelRefDto("vieneu", "vieneu-v3-turbo", "default");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "script", job.getSourceText() != null ? job.getSourceText() : "",
            "voice", voiceInput.voice(),
            "format", Map.of("container", "wav", "sampleRateHz", 48000, "channels", 1));
    OutputArtifactTargetDto output =
        artifactAccess.createOutput(taskId, attemptId, "narration", "audio/wav");
    TaskArtifactsDto artifacts = new TaskArtifactsDto(voiceInput.artifacts(), List.of(output));

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
      log.info(
          "Narration generation task submitted for job {}; taskId={}, attemptId={}, handle={}, nextReconcileAt={}",
          jobId,
          taskId,
          attemptId,
          receipt.executionHandle(),
          nextReconcile);
    } catch (RuntimeException e) {
      log.error("Failed to submit narration generation task for job {}", jobId, e);
      if (isOutcomeAmbiguous(e)) {
        Instant nextReconcile = Instant.now().plusSeconds(2);
        transactionService.markSubmissionUnknown(
            jobId, "COMPUTE_OUTCOME_UNKNOWN", "Narration dispatch outcome unknown", nextReconcile);
      } else {
        transactionService.markSubmissionFailed(
            jobId, "NARRATION_DISPATCH_ERROR", "Failed to dispatch narration");
      }
    }
  }

  /**
   * Submits WhisperX forced alignment of the synthesized audio against the exact script that was
   * spoken. The audio is the media asset named by the job key, so a regenerated narration is never
   * aligned with the timing of its predecessor.
   */
  private void submitAlignment(GenerationJob job) {
    UUID jobId = job.getJobId();
    UUID taskId = jobId;
    UUID attemptId = ComputeAttemptIdentity.forJob(jobId, job.getType());
    InputArtifactRefDto audio;
    OutputArtifactTargetDto output;
    try {
      audio =
          artifactAccess.createInput(
              job.getProjectId(), NarrationAlignmentAdmission.alignedMediaAssetId(job), ALIGN_ROLE);
      output = artifactAccess.createOutput(taskId, attemptId, "alignment", "application/json");
    } catch (RuntimeException e) {
      log.error("Narration alignment inputs could not be prepared for job {}", jobId, e);
      transactionService.markSubmissionFailed(
          jobId, "NARRATION_ALIGN_INPUT_UNAVAILABLE", "Narration audio is unavailable");
      return;
    }

    TaskDescriptorDto task = new TaskDescriptorDto("audio.align", "1.0");
    ModelRefDto model = new ModelRefDto("whisperx", "large-v3", "3.8.6");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "script",
            job.getSourceText() == null ? "" : job.getSourceText(),
            "language",
            workerLanguage(job.getSourceLanguage()),
            "audioArtifactRole",
            ALIGN_ROLE);
    TaskArtifactsDto artifacts = new TaskArtifactsDto(List.of(audio), List.of(output));
    String fingerprint =
        CanonicalFingerprintCalculator.calculateFingerprint(
            PROTOCOL_VERSION, task, model, constraints, inputs, artifacts);
    ComputeTaskRequest request =
        new ComputeTaskRequest(
            PROTOCOL_VERSION,
            taskId,
            attemptId,
            "compute:align:" + taskId,
            fingerprint,
            task,
            model,
            constraints,
            inputs,
            artifacts);

    try {
      ComputeSubmissionReceipt receipt = executionPort.submitTask(request);
      transactionService.markSubmitted(jobId, receipt, Instant.now().plusSeconds(2));
      log.info(
          "Narration alignment submitted for job {}; handle={}", jobId, receipt.executionHandle());
    } catch (RuntimeException e) {
      log.error("Failed to submit narration alignment for job {}", jobId, e);
      if (isOutcomeAmbiguous(e)) {
        transactionService.markSubmissionUnknown(
            jobId,
            "COMPUTE_OUTCOME_UNKNOWN",
            "Narration alignment outcome unknown",
            Instant.now().plusSeconds(2));
      } else {
        transactionService.markSubmissionFailed(
            jobId, "NARRATION_ALIGN_DISPATCH_ERROR", "Failed to dispatch narration alignment");
      }
    }
  }

  /** The worker takes a bare language ("vi") or a language-REGION tag ("vi-VN"). */
  static String workerLanguage(String sourceLanguage) {
    if (sourceLanguage != null && sourceLanguage.matches("^[a-z]{2,3}(-[A-Z]{2})?$")) {
      return sourceLanguage;
    }
    if (sourceLanguage != null && sourceLanguage.matches("^[A-Za-z]{2,3}([-_][A-Za-z]{2})?$")) {
      String[] parts = sourceLanguage.split("[-_]");
      return parts.length == 1
          ? parts[0].toLowerCase(java.util.Locale.ROOT)
          : parts[0].toLowerCase(java.util.Locale.ROOT)
              + "-"
              + parts[1].toUpperCase(java.util.Locale.ROOT);
    }
    return "vi";
  }

  /**
   * Explicit request reference wins; otherwise a custom catalog voice supplies its stored reference
   * recording; otherwise the preset name is sent to the worker.
   */
  private VoiceInput resolveVoice(GenerationJob job) {
    NarrationRequest request =
        narrationRequestRepository
            .findByGenerationJobId(job.getId())
            .orElseThrow(() -> new IllegalStateException("Narration request not found for job"));
    VoiceCatalogAccess.VoiceCapabilities voice =
        voiceCatalogAccess
            .findVoice(request.voiceId())
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Narration voice is unavailable or disabled: " + request.voiceId()));

    VoiceReferenceSelection reference = request.voiceReference();
    if (reference == null && voice.referenceAssetId() != null) {
      reference =
          new VoiceReferenceSelection(VoiceReferenceScope.GLOBAL_LOCAL, voice.referenceAssetId());
    }
    if (reference == null) {
      return new VoiceInput(
          Map.of("kind", "catalog", "value", voice.synthesisVoiceName()), List.of());
    }

    InputArtifactRefDto artifact =
        reference.scope() == VoiceReferenceScope.PROJECT
            ? artifactAccess.createInput(
                request.projectId(), reference.assetId(), VOICE_REFERENCE_ROLE)
            : artifactAccess.createVoiceReferenceInput(reference.assetId(), VOICE_REFERENCE_ROLE);
    return new VoiceInput(
        Map.of("kind", "artifact", "value", VOICE_REFERENCE_ROLE), List.of(artifact));
  }

  private record VoiceInput(Map<String, Object> voice, List<InputArtifactRefDto> artifacts) {}

  private boolean isOutcomeAmbiguous(RuntimeException exception) {
    if (exception instanceof ComputeClientException computeException) {
      int statusCode = computeException.getStatusCode();
      return statusCode == 0 || statusCode >= 500;
    }
    return true;
  }
}
