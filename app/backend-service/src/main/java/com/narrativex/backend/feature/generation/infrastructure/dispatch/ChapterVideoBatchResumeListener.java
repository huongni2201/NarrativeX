package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.event.GenerationJobChangedEvent;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.service.ChapterVideoBatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Advances a chapter video batch as soon as one of its leaf jobs reaches a terminal state.
 *
 * <p>The work runs on a MEDIA-lane virtual thread, never on the committing thread: after commit the
 * original transaction is finished, so a transactional resume must start from a clean thread. If
 * the lane is full the request is dropped and the periodic scheduler picks the batch up.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = "narrativex.generation.dispatch.parallel-enabled",
    havingValue = "true")
public class ChapterVideoBatchResumeListener {
  private final MediaGenerationItemRepository items;
  private final ChapterVideoBatchService batches;
  private final GenerationDispatchExecutor executor;

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
  void on(GenerationJobChangedEvent event) {
    var job = event.job();
    if (job.getId() == null || !job.getStatus().isTerminal() || job.isChapterVideoBatch()) {
      return;
    }
    try {
      executor.trySubmitBatchResume(
          job.getId(),
          () ->
              items
                  .findBatchJobIdByLeaf(job.getId())
                  .ifPresent(
                      batchJobId -> {
                        try {
                          batches.resume(batchJobId);
                        } catch (RuntimeException failure) {
                          log.warn(
                              "Batch {} could not advance after leaf {} finished; the scheduler will retry",
                              batchJobId,
                              job.getJobId(),
                              failure);
                        }
                      }));
    } catch (RuntimeException failure) {
      log.warn("Could not schedule batch resume for job {}", job.getJobId(), failure);
    }
  }
}
