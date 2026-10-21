package com.narrativex.backend.feature.generation.infrastructure.finalizer;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationAssetRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.application.service.AlignmentWordsParser;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizer;
import com.narrativex.backend.feature.generation.application.service.InvalidComputeOutputException;
import com.narrativex.backend.feature.generation.application.service.NarrationAlignmentAdmission;
import com.narrativex.backend.feature.generation.application.service.WavPcmFormat;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.value.WordAlignment;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Finalizes narration jobs upon compute success (callback or reconciliation). A synthesis job
 * registers the WAV as the request's audio master and admits its forced alignment; an alignment job
 * stores the word timing measured on exactly that audio.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NarrationGenerationResultFinalizer implements ComputeResultFinalizer {
  /** Matches the version the production timeline and render snapshots read. */
  public static final String ALIGNMENT_VERSION = "whisperx-forced-v1";

  private static final String VOICE_PREVIEW_PREFIX = "voice-preview:";
  private static final long ALIGNMENT_END_TOLERANCE_MS = 250L;
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final GenerationJobRepository generationJobRepository;
  private final MediaAssetRepository mediaAssetRepository;
  private final ComputeArtifactAccess artifactAccess;
  private final NarrationRequestRepository narrationRequestRepository;
  private final NarrationAssetRepository narrationAssetRepository;
  private final NarrationAlignmentAdmission alignmentAdmission;

  @Override
  public JobType supportedType() {
    return JobType.NARRATION_GENERATE;
  }

  @Override
  @Transactional(noRollbackFor = InvalidComputeOutputException.class)
  public void finalizeResult(GenerationJob job, ComputeObservationDto observation) {
    if (job.getStatus().isTerminal()) {
      log.debug(
          "Job {} is already terminal ({}), skipping finalization",
          job.getJobId(),
          job.getStatus());
      return;
    }
    if (NarrationAlignmentAdmission.isAlignmentJob(job)) {
      finalizeAlignment(job, observation);
    } else {
      finalizeSynthesis(job, observation);
    }
  }

  private void finalizeSynthesis(GenerationJob job, ComputeObservationDto observation) {
    ProducedArtifactDto produced = requireOutput(observation, "narration", "audio/wav");
    OutputArtifactTargetDto target = verifiedTarget(job, produced);

    WavPcmFormat wav;
    try {
      wav = WavPcmFormat.parse(artifactAccess.readOutput(target));
    } catch (IllegalArgumentException invalid) {
      throw new InvalidComputeOutputException(invalid.getMessage(), invalid);
    }
    if (!wav.isNarrationMaster()) {
      throw new InvalidComputeOutputException(
          "Narration audio must be 48 kHz mono 16-bit PCM but was "
              + wav.sampleRateHz()
              + " Hz, "
              + wav.channels()
              + " channel(s), "
              + wav.bitsPerSample()
              + " bit");
    }

    String storageKey = artifactAccess.storageKey(target);
    mediaAssetRepository.createGeneratedAsset(
        new MediaAssetRepository.CreateGeneratedMediaAsset(
            produced.artifactId(),
            job.getProjectId(),
            "AUDIO",
            "TTS_GENERATED",
            storageKey,
            job.getJobId() + ".wav",
            produced.mediaType(),
            produced.sizeBytes(),
            produced.sha256(),
            null));

    var request =
        narrationRequestRepository
            .findByGenerationJobId(job.getId())
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Narration job " + job.getJobId() + " has no narration request"));
    narrationAssetRepository.register(
        new NarrationAssetRepository.Registration(
            produced.artifactId(),
            job.getProjectId(),
            request.id(),
            storageKey,
            job.getJobId() + ".wav",
            produced.mediaType(),
            wav.durationMs(),
            produced.sizeBytes(),
            WavPcmFormat.CODEC,
            wav.sampleRateHz(),
            wav.channels(),
            produced.sha256()));

    boolean preview =
        job.getIdempotencyKey() != null && job.getIdempotencyKey().startsWith(VOICE_PREVIEW_PREFIX);
    if (!preview) {
      alignmentAdmission.admit(job, produced.artifactId());
    }
    complete(job, "NARRATION_READY");
    log.info("Narration generation completed and asset finalized for job {}", job.getJobId());
  }

  private void finalizeAlignment(GenerationJob job, ComputeObservationDto observation) {
    ProducedArtifactDto produced = requireOutput(observation, "alignment", "application/json");
    OutputArtifactTargetDto target = verifiedTarget(job, produced);

    UUID mediaAssetId = NarrationAlignmentAdmission.alignedMediaAssetId(job);
    var asset = narrationAssetRepository.findCurrentByMediaAssetId(mediaAssetId);
    if (asset.isEmpty()) {
      // The narration was regenerated while this alignment ran; it measured audio that is gone.
      log.info("Alignment job {} measured superseded audio {}", job.getJobId(), mediaAssetId);
      complete(job, "NARRATION_ALIGNMENT_SUPERSEDED");
      return;
    }

    long durationMs = asset.get().durationMs();
    List<WordAlignment> words;
    try {
      words =
          clampToAudio(
              AlignmentWordsParser.parse(
                  artifactAccess.readOutput(target), durationMs, ALIGNMENT_END_TOLERANCE_MS),
              durationMs);
    } catch (IllegalArgumentException invalid) {
      throw new InvalidComputeOutputException(invalid.getMessage(), invalid);
    }
    narrationAssetRepository.saveAlignment(
        asset.get().id(),
        asset.get().sourceHash(),
        ALIGNMENT_VERSION,
        JSON.writeValueAsString(words));
    complete(job, "NARRATION_ALIGNED");
    log.info("Narration alignment stored for job {}", job.getJobId());
  }

  /** Frame-granular word ends may pass the audio by a few ms; the stored clock must not. */
  static List<WordAlignment> clampToAudio(List<WordAlignment> words, long durationMs) {
    return words.stream()
        .map(
            word -> {
              if (word.audioStartMs() >= durationMs) {
                throw new IllegalArgumentException("alignment word starts after the audio ends");
              }
              return new WordAlignment(
                  word.index(),
                  word.textStart(),
                  word.textEnd(),
                  word.audioStartMs(),
                  Math.min(word.audioEndMs(), durationMs),
                  word.confidence());
            })
        .toList();
  }

  private static ProducedArtifactDto requireOutput(
      ComputeObservationDto observation, String role, String mediaType) {
    return observation.outputs().stream()
        .filter(
            artifact ->
                artifact != null
                    && role.equalsIgnoreCase(artifact.role())
                    && mediaType.equalsIgnoreCase(artifact.mediaType()))
        .findFirst()
        .orElseThrow(
            () ->
                new InvalidComputeOutputException(
                    "Compute observation is missing required " + role + " output"));
  }

  private OutputArtifactTargetDto verifiedTarget(GenerationJob job, ProducedArtifactDto produced) {
    UUID attemptId =
        job.getComputeAttemptId() != null
            ? job.getComputeAttemptId()
            : ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());
    OutputArtifactTargetDto target =
        artifactAccess.getOrCreateTarget(
            job.getJobId(),
            attemptId,
            produced.artifactId(),
            produced.role(),
            produced.mediaType());
    artifactAccess.verifyOutput(target, produced);
    return target;
  }

  private void complete(GenerationJob job, String step) {
    GenerationJob freshJob = generationJobRepository.findByJobId(job.getJobId()).orElse(job);
    if (!freshJob.getStatus().isTerminal()) {
      generationJobRepository.save(freshJob.markCompleted(step));
    }
  }
}
