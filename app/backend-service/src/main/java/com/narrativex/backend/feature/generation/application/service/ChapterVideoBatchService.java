package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.port.out.*;
import com.narrativex.backend.feature.generation.application.usecase.GenerateShotTakeUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.time.Instant;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Resumes the durable frozen shot list; leaf admission and item binding commit together. */
@Slf4j
@Service
public class ChapterVideoBatchService {
  private static final String CANCEL_REQUESTED = "BATCH_CANCEL_REQUESTED";
  private final GenerationJobRepository jobs;
  private final MediaGenerationItemRepository items;
  private final TakeRepository takes;
  private final GenerateShotTakeUseCase admission;
  private final ChapterAnalysisSourceAccess chapters;
  private final NarrativeXLimitsProperties limits;
  private final GenerationExecutionPort execution;
  private final TransactionTemplate transactions;

  public ChapterVideoBatchService(GenerationJobRepository jobs, MediaGenerationItemRepository items,
      TakeRepository takes, GenerateShotTakeUseCase admission, ChapterAnalysisSourceAccess chapters,
      NarrativeXLimitsProperties limits, GenerationExecutionPort execution, PlatformTransactionManager manager) {
    this.jobs = jobs; this.items = items; this.takes = takes; this.admission = admission;
    this.chapters = chapters; this.limits = limits; this.execution = execution;
    this.transactions = new TransactionTemplate(manager);
  }

  /** Called by the existing outbox tick, including after a backend restart. */
  public void resumePending() {
    for (var job : jobs.findActiveChapterVideoBatches(32)) {
      try { resume(job.getJobId()); }
      catch (RuntimeException failure) { log.warn("Chapter video batch {} remains pending", job.getJobId(), failure); }
    }
  }

  public void resume(UUID jobId) { transactions.executeWithoutResult(ignored -> advance(jobId)); }

  private GenerationJob locked(UUID jobId) {
    jobs.acquireIdempotencyLock("chapter-video-batch:" + jobId);
    return jobs.findByJobId(jobId).orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
  }

  private void advance(UUID jobId) {
    var parent = locked(jobId);
    if (!parent.isChapterVideoBatch() || !parent.getStatus().isActive()) return;
    // Match standalone admission lock order: Chapter, then global capacity, then shot admission.
    chapters.requireForAnalysisLocked(parent.getProjectId(), parent.getChapterId());
    jobs.acquireAnalysisCapacityLock();
    boolean canceled = CANCEL_REQUESTED.equals(parent.getErrorCode());
    for (var item : items.findByJobId(parent.getId())) {
      if (item.getLeafGenerationJobId() != null) {
        projectLeaf(item);
      } else if (item.getExecutionStatus().name().equals("QUEUED")) {
        if (canceled) { items.updateExecution(item.getId(), "CANCELED", null, CANCEL_REQUESTED); continue; }
        if (jobs.countActiveJobs() >= limits.getMaxConcurrentExpensiveJobs()) break;
        try {
          var take = admission.executeFrozen(new GenerateShotTakeCommand(parent.getProjectId(), item.getShotId(),
              null, null, null, null, leafKey(parent, item), null), item.getFrozenInputFingerprint());
          var leaf = jobs.findByJobId(take.jobId()).orElseThrow();
          items.bindLeaf(item.getId(), leaf.getId(), take.id());
        } catch (ResourceConflictException | DomainValidationException | ResourceNotFoundException invalid) {
          items.updateExecution(item.getId(), "FAILED", null, "FROZEN_INPUT_CONFLICT");
        }
      }
    }
    var all = items.findByJobId(parent.getId());
    long terminal = all.stream().filter(ChapterVideoBatchService::terminal).count();
    int progress = all.isEmpty() ? 0 : (int) (100L * terminal / all.size());
    GenerationJob updated;
    if (!all.isEmpty() && terminal == all.size()) {
      updated = canceled ? parent.markCanceled("BATCH_CANCELED", "All shot outcomes reconciled")
          : all.stream().allMatch(i -> i.getExecutionStatus().name().equals("READY"))
              ? parent.markCompleted("All shots generated")
              : parent.markFailed("BATCH_ITEM_FAILED", "All shot outcomes reconciled");
    } else {
      boolean unknown = all.stream().anyMatch(i -> i.getExecutionStatus().name().equals("UNKNOWN"));
      updated = parent.markRunning("Shots " + terminal + "/" + all.size(), progress)
          .toBuilder().status(unknown ? JobStatus.UNKNOWN : JobStatus.RUNNING)
          .errorCode(canceled ? CANCEL_REQUESTED : null).build();
    }
    if (parent.getStatus() != updated.getStatus() || parent.getProgress() != updated.getProgress()
        || !Objects.equals(parent.getErrorCode(), updated.getErrorCode())
        || !Objects.equals(parent.getCurrentStep(), updated.getCurrentStep())) jobs.save(updated);
  }

  private void projectLeaf(MediaGenerationItem item) {
    var leaf = jobs.findById(item.getLeafGenerationJobId()).orElseThrow();
    var take = takes.findById(item.getTakeId()).orElseThrow();
    String status = switch (leaf.getStatus()) {
      case COMPLETED -> "READY";
      case FAILED -> "FAILED";
      case CANCELED -> "CANCELED";
      case UNKNOWN, RECONCILING, STALLED -> "UNKNOWN";
      case QUEUED -> "QUEUED";
      default -> "RUNNING";
    };
    items.updateExecution(item.getId(), status, take.outputAssetId(), leaf.getErrorCode());
  }

  /** A request is durable before worker I/O; a cancel acknowledgement is not a terminal outcome. */
  public GenerationJob cancel(UUID jobId) {
    var remote = transactions.execute(ignored -> {
      var parent = locked(jobId);
      if (!parent.getStatus().isActive()) return List.<GenerationJob>of();
      jobs.save(parent.toBuilder().errorCode(CANCEL_REQUESTED).build());
      var active = new ArrayList<GenerationJob>();
      for (var item : items.findByJobId(parent.getId())) {
        if (item.getLeafGenerationJobId() == null) {
          items.updateExecution(item.getId(), "CANCELED", null, CANCEL_REQUESTED);
        } else {
          var leaf = jobs.findById(item.getLeafGenerationJobId()).orElseThrow();
          if (leaf.getStatus() == JobStatus.QUEUED) {
            jobs.save(leaf.markCanceled("COMPUTE_CANCELED", "Batch cancellation before submission"));
          } else if (leaf.getStatus().isActive()) {
            jobs.save(leaf.markUnknown("COMPUTE_CANCEL_REQUESTED", "Awaiting cancellation outcome", Instant.now()));
            active.add(leaf);
          }
          projectLeaf(item);
        }
      }
      return active;
    });
    for (var leaf : Objects.requireNonNull(remote)) {
      try { execution.cancelTask(leaf.getJobId(), leaf.getComputeAttemptId()); }
      catch (RuntimeException failure) { log.warn("Batch leaf cancellation outcome unknown for {}", leaf.getJobId()); }
    }
    resume(jobId);
    return jobs.findByJobId(jobId).orElseThrow();
  }

  public static String leafKey(GenerationJob parent, MediaGenerationItem item) {
    return "batch:" + parent.getJobId() + ":" + item.getItemKey();
  }
  private static boolean terminal(MediaGenerationItem item) {
    return Set.of("READY", "FAILED", "CANCELED").contains(item.getExecutionStatus().name());
  }
}
