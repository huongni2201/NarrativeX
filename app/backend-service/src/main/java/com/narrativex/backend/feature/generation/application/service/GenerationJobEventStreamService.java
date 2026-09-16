package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Streams generation-job snapshots to Desktop clients. */
@Slf4j
@Service
@RequiredArgsConstructor
public class GenerationJobEventStreamService {
  private static final long EMITTER_TIMEOUT_MILLIS = Duration.ofMinutes(30).toMillis();
  private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(15);

  private final GenerationJobRepository generationJobRepository;
  private final ConcurrentHashMap<UUID, CopyOnWriteArrayList<Subscription>> subscriptions =
      new ConcurrentHashMap<>();

  public SseEmitter subscribe(UUID jobId) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

    SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MILLIS);
    Subscription subscription = new Subscription(emitter);
    subscriptions.computeIfAbsent(jobId, ignored -> new CopyOnWriteArrayList<>()).add(subscription);

    emitter.onCompletion(() -> remove(jobId, subscription));
    emitter.onTimeout(
        () -> {
          remove(jobId, subscription);
          emitter.complete();
        });
    emitter.onError(ignored -> remove(jobId, subscription));

    sendSnapshot(jobId, subscription, job, snapshotFor(jobId, job));
    return emitter;
  }

  @Scheduled(fixedDelayString = "${narrativex.generation.sse-watch-delay-ms:750}")
  public void publishChanges() {
    subscriptions.forEach(this::publishJobChanges);
  }

  int activeSubscriptionCount() {
    return subscriptions.values().stream().mapToInt(List::size).sum();
  }

  private void publishJobChanges(UUID jobId, CopyOnWriteArrayList<Subscription> jobSubscriptions) {
    if (jobSubscriptions.isEmpty()) {
      subscriptions.remove(jobId, jobSubscriptions);
      return;
    }

    var current = generationJobRepository.findByJobId(jobId);
    if (current.isEmpty()) {
      completeAll(jobId, jobSubscriptions);
      return;
    }

    GenerationJob job = current.get();
    JobResponse snapshot = snapshotFor(jobId, job);
    for (Subscription subscription : jobSubscriptions) {
      if (!snapshot.equals(subscription.lastSnapshot())) {
        sendSnapshot(jobId, subscription, job, snapshot);
      } else if (Duration.between(subscription.lastSentAt(), Instant.now())
              .compareTo(HEARTBEAT_INTERVAL)
          >= 0) {
        sendHeartbeat(jobId, subscription);
      }
    }
  }

  private JobResponse snapshotFor(UUID jobId, GenerationJob job) {
    var analysisProgress = generationJobRepository.findAnalysisProgressByJobId(jobId).orElse(null);
    return JobResponse.fromWithAnalysisProgress(job, analysisProgress);
  }

  private void sendSnapshot(
      UUID jobId, Subscription subscription, GenerationJob job, JobResponse snapshot) {
    try {
      subscription
          .emitter()
          .send(
              SseEmitter.event()
                  .name("snapshot")
                  .id(eventId(job, snapshot))
                  .reconnectTime(1_500L)
                  .data(snapshot));
      subscription.markSent(snapshot);
      if (!job.getStatus().isActive()) {
        remove(jobId, subscription);
        subscription.emitter().complete();
      }
    } catch (IOException | IllegalStateException exception) {
      remove(jobId, subscription);
      subscription.emitter().completeWithError(exception);
    }
  }

  private void sendHeartbeat(UUID jobId, Subscription subscription) {
    try {
      subscription.emitter().send(SseEmitter.event().comment("heartbeat"));
      subscription.markHeartbeat();
    } catch (IOException | IllegalStateException exception) {
      remove(jobId, subscription);
      subscription.emitter().completeWithError(exception);
    }
  }

  private void completeAll(UUID jobId, CopyOnWriteArrayList<Subscription> jobSubscriptions) {
    subscriptions.remove(jobId, jobSubscriptions);
    for (Subscription subscription : jobSubscriptions) {
      subscription.emitter().complete();
    }
  }

  private void remove(UUID jobId, Subscription subscription) {
    var jobSubscriptions = subscriptions.get(jobId);
    if (jobSubscriptions == null) {
      return;
    }
    jobSubscriptions.remove(subscription);
    if (jobSubscriptions.isEmpty()) {
      subscriptions.remove(jobId, jobSubscriptions);
    }
  }

  static String eventId(GenerationJob job, JobResponse snapshot) {
    return job.getId()
        + ":"
        + snapshot.status()
        + ':'
        + snapshot.progress()
        + ':'
        + value(snapshot.currentStep())
        + ':'
        + value(snapshot.errorCode())
        + ':'
        + value(snapshot.phase())
        + ':'
        + value(snapshot.completedShards())
        + ':'
        + value(snapshot.mediaPlanId())
        + ':'
        + value(snapshot.mediaPlanRevision())
        + ':'
        + value(snapshot.repairCount())
        + ':'
        + value(snapshot.continuityReportId());
  }

  private static String value(Object value) {
    return value == null ? "" : value.toString();
  }

  private static final class Subscription {
    private final SseEmitter emitter;
    private volatile JobResponse lastSnapshot;
    private volatile Instant lastSentAt = Instant.EPOCH;

    private Subscription(SseEmitter emitter) {
      this.emitter = emitter;
    }

    SseEmitter emitter() {
      return emitter;
    }

    JobResponse lastSnapshot() {
      return lastSnapshot;
    }

    Instant lastSentAt() {
      return lastSentAt;
    }

    void markSent(JobResponse snapshot) {
      lastSnapshot = snapshot;
      lastSentAt = Instant.now();
    }

    void markHeartbeat() {
      lastSentAt = Instant.now();
    }
  }
}
