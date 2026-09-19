package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.api.internal.ComputeEventRequest;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.service.GenerationJobStateMachine;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ComputeEventReceiptMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ComputeEventReceiptRow;
import java.time.Instant;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ComputeEventApplicationService {

  public enum ProcessingOutcome {
    PROCESSED,
    DUPLICATE,
    STALE_SEQUENCE,
    ALREADY_TERMINAL,
    JOB_NOT_FOUND
  }

  private final GenerationJobRepository generationJobRepository;
  private final ComputeEventReceiptMapper computeEventReceiptMapper;
  private final ComputeResultFinalizerRegistry finalizerRegistry;
  private final GenerationJobEventBroadcaster eventBroadcaster;

  @Transactional
  public ProcessingOutcome processEvent(ComputeEventRequest request, String payloadHash) {
    if (request == null || request.eventId() == null) {
      throw new IllegalArgumentException("Compute event request and eventId must not be null");
    }

    // Invariant: Idempotent receipt deduplication
    if (computeEventReceiptMapper.existsByEventId(request.eventId())) {
      log.info("Duplicate event {} received for task {}; skipping", request.eventId(), request.taskId());
      return ProcessingOutcome.DUPLICATE;
    }

    // Persist event receipt
    computeEventReceiptMapper.insert(
        new ComputeEventReceiptRow(
            request.eventId(),
            request.taskId(),
            request.attemptId(),
            request.sequence(),
            request.state(),
            Instant.now(),
            payloadHash));

    // Resolve domain job
    Optional<GenerationJob> jobOpt =
        generationJobRepository.findByComputeAttempt(request.taskId(), request.attemptId());
    if (jobOpt.isEmpty()) {
      jobOpt = generationJobRepository.findByJobId(request.taskId());
    }

    if (jobOpt.isEmpty()) {
      log.warn(
          "No GenerationJob found for compute event {} (taskId={}, attemptId={})",
          request.eventId(),
          request.taskId(),
          request.attemptId());
      return ProcessingOutcome.JOB_NOT_FOUND;
    }

    GenerationJob job = jobOpt.get();

    // Invariant: Terminal immutability
    if (job.getStatus().isTerminal()) {
      log.info(
          "Job {} already terminal ({}); ignoring event {} state {}",
          job.getJobId(),
          job.getStatus(),
          request.eventId(),
          request.state());
      return ProcessingOutcome.ALREADY_TERMINAL;
    }

    // Invariant: Monotonic sequence enforcement
    if (GenerationJobStateMachine.isStaleSequence(job, request.sequence())) {
      log.warn(
          "Stale event sequence {} received for job {} with sequence {}",
          request.sequence(),
          job.getJobId(),
          job.getComputeSequence());
      return ProcessingOutcome.STALE_SEQUENCE;
    }

    // Record incoming callback metadata
    job = job.recordCallback(request.eventId(), request.sequence(), Instant.now());

    String state = request.state() != null ? request.state().toUpperCase() : "";
    switch (state) {
      case "RUNNING" -> {
        int progress = (int) Math.round(request.progress() != null ? request.progress() * 100 : 30);
        if (job.getStatus() != JobStatus.RUNNING) {
          job =
              job.markRunningWithCompute(
                  "COMPUTING_MEDIA",
                  progress,
                  request.sequence(),
                  request.state(),
                  request.executionHandle());
        }
        GenerationJob saved = generationJobRepository.save(job);
        eventBroadcaster.broadcastJobEvent(saved);
        return ProcessingOutcome.PROCESSED;
      }
      case "SUCCEEDED" -> {
        generationJobRepository.save(job);
        Optional<ComputeResultFinalizer> finalizerOpt =
            finalizerRegistry.findFinalizer(job.getType());
        if (finalizerOpt.isPresent()) {
          finalizerOpt.get().finalizeResult(job, request.toObservationDto());
        } else {
          log.warn("No finalizer found for JobType {}; marking completed directly", job.getType());
          job = job.markCompleted("COMPUTE_SUCCEEDED");
          generationJobRepository.save(job);
        }
        GenerationJob finalJob =
            generationJobRepository.findByJobId(job.getJobId()).orElse(job);
        eventBroadcaster.broadcastJobEvent(finalJob);
        return ProcessingOutcome.PROCESSED;
      }
      case "FAILED" -> {
        String errCode =
            request.error() != null && request.error().code() != null
                ? request.error().code()
                : "COMPUTE_FAILED";
        String errMsg =
            request.error() != null && request.error().message() != null
                ? request.error().message()
                : "Compute plane reported execution failure";
        job = job.markFailed(errCode, errMsg);
        GenerationJob saved = generationJobRepository.save(job);
        eventBroadcaster.broadcastJobEvent(saved);
        return ProcessingOutcome.PROCESSED;
      }
      case "CANCELED" -> {
        job = job.markCanceled("COMPUTE_CANCELED", "Compute task canceled");
        GenerationJob saved = generationJobRepository.save(job);
        eventBroadcaster.broadcastJobEvent(saved);
        return ProcessingOutcome.PROCESSED;
      }
      default -> {
        log.debug(
            "Event {} for job {} had non-terminal state {}; recorded callback",
            request.eventId(),
            job.getJobId(),
            state);
        GenerationJob saved = generationJobRepository.save(job);
        eventBroadcaster.broadcastJobEvent(saved);
        return ProcessingOutcome.PROCESSED;
      }
    }
  }
}
