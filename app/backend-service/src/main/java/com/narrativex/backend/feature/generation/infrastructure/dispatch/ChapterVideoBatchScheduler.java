package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.service.ChapterVideoBatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Safety-net tick for chapter video batches in lane-based dispatch mode. Batches normally advance
 * the moment one of their leaf jobs becomes terminal (see {@link ChapterVideoBatchResumeListener});
 * this tick recovers from restarts and missed events.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = "narrativex.generation.dispatch.parallel-enabled",
    havingValue = "true")
public class ChapterVideoBatchScheduler {
  private final ChapterVideoBatchService batches;

  @Scheduled(fixedDelayString = "${narrativex.generation.batch-resume-delay-ms:5000}")
  public void resumeActiveBatches() {
    batches.resumePending();
  }
}
