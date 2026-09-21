package com.narrativex.backend.feature.generation.infrastructure.reconciliation;

import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodically scans for generation jobs that are due for reconciliation fallback. Uses bounded
 * batch size and non-blocking single-job reconciliation.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    prefix = "narrativex.compute.reconciliation",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true)
public class ComputeReconciliationScheduler {

  private static final int BATCH_SIZE = 50;

  private final GenerationJobRepository jobRepository;
  private final ComputeReconciliationService reconciliationService;

  @Scheduled(fixedDelayString = "${narrativex.compute.reconciliation.fixed-delay-ms:5000}")
  public void pollDueJobs() {
    Instant now = Instant.now();
    List<GenerationJob> dueJobs;
    try {
      dueJobs = jobRepository.findJobsDueForReconciliation(now, BATCH_SIZE);
    } catch (Exception ex) {
      log.debug("Failed to query generation jobs due for reconciliation: {}", ex.getMessage());
      return;
    }

    if (dueJobs.isEmpty()) {
      return;
    }

    log.debug("Found {} generation jobs due for reconciliation", dueJobs.size());
    for (GenerationJob job : dueJobs) {
      try {
        reconciliationService.reconcileOnce(job.getJobId());
      } catch (Exception ex) {
        log.warn("Error reconciling generation job {}: {}", job.getJobId(), ex.getMessage());
      }
    }
  }
}
