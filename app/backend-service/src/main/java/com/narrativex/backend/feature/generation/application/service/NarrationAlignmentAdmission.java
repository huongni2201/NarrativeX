package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Persists the intent to force-align a freshly synthesized narration before any worker I/O. The
 * alignment is a second durable job of the same family as the TTS job, keyed by the audio it
 * measures, so a repeated finalization admits it once and a regenerated audio gets its own.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NarrationAlignmentAdmission {
  public static final String KEY_PREFIX = "narration-align:";
  public static final String STAGE_NAME = "NARRATION_ALIGN";

  private final GenerationJobRepository generationJobRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;

  public static boolean isAlignmentJob(GenerationJob job) {
    return job != null
        && job.getIdempotencyKey() != null
        && job.getIdempotencyKey().startsWith(KEY_PREFIX);
  }

  /** The media asset whose bytes an alignment job measures. */
  public static UUID alignedMediaAssetId(GenerationJob job) {
    return UUID.fromString(job.getIdempotencyKey().substring(KEY_PREFIX.length()));
  }

  /** Admits the alignment of {@code mediaAssetId}; returns the existing job on a repeat. */
  public GenerationJob admit(GenerationJob synthesisJob, UUID mediaAssetId) {
    String key = KEY_PREFIX + mediaAssetId;
    generationJobRepository.acquireIdempotencyLock(key);
    var existing = generationJobRepository.findByIdempotencyKey(key);
    if (existing.isPresent()) return existing.get();

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.rehydrate(
                null,
                0L,
                UuidV7.random(),
                synthesisJob.getProjectId(),
                JobType.NARRATION_GENERATE,
                JobStatus.QUEUED,
                ResourceClass.PROVIDER_INTERACTIVE,
                0,
                "QUEUED",
                null,
                synthesisJob.getStoryVersionId(),
                synthesisJob.getChapterId(),
                null,
                synthesisJob.getChapterRowVersion(),
                synthesisJob.getSourceHash(),
                synthesisJob.getSourceText(),
                synthesisJob.getSourceLanguage(),
                key));
    OperationPlan plan =
        operationPlanRepository.save(OperationPlan.create(job.getProjectId(), STAGE_NAME));
    operationPlanRepository.save(plan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Admitted narration alignment job={} for mediaAssetId={} after synthesis job={}",
        job.getJobId(),
        mediaAssetId,
        synthesisJob.getJobId());
    return job;
  }
}
