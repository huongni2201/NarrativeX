package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
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

/**
 * Streams owner-scoped generation-job snapshots to Desktop clients.
 *
 * <p>PostgreSQL remains the authoritative status source because Python workers update generation
 * state directly in the database. The server watches only jobs with active subscribers and pushes
 * changes over SSE, which removes high-frequency polling from every Desktop renderer without
 * introducing Redis as a second source of truth.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GenerationJobEventStreamService {
  private static final long EMITTER_TIMEOUT_MILLIS = Duration.ofMinutes(30).toMillis();
  private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(15);

  private final CurrentUserId currentUserId;
  private final GenerationJobRepository generationJobRepository;
  private final ConcurrentHashMap<UUID, CopyOnWriteArrayList<Subscription>> subscriptions =
      new ConcurrentHashMap<>();

  public SseEmitter subscribe(UUID jobId) {
    String ownerId = currentUserId.get();
    GenerationJob job =
        generationJobRepository
            .findByJobIdAndOwner(jobId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

    SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MILLIS);
    Subscription subscription = new Subscription(ownerId, emitter);
    subscriptions.computeIfAbsent(jobId, ignored -> new CopyOnWriteArrayList<>()).add(subscription);

    emitter.onCompletion(() -> remove(jobId, subscription));
    emitter.onTimeout(
        () -> {
          remove(jobId, subscription);
          emitter.complete();
        });
    emitter.onError(ignored -> remove(jobId, subscription));

    sendSnapshot(jobId, subscription, job);
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

    String ownerId = jobSubscriptions.getFirst().ownerId();
    var current = generationJobRepository.findByJobIdAndOwner(jobId, ownerId);
    if (current.isEmpty()) {
      completeAll(jobId, jobSubscriptions);
      return;
    }

    GenerationJob job = current.get();
    for (Subscription subscription : jobSubscriptions) {
      if (!ownerId.equals(subscription.ownerId())) {
        remove(jobId, subscription);
        subscription.emitter().completeWithError(new IllegalStateException("Job owner changed"));
        continue;
      }

      JobResponse snapshot = JobResponse.from(job);
      if (!snapshot.equals(subscription.lastSnapshot())) {
        sendSnapshot(jobId, subscription, job);
      } else if (Duration.between(subscription.lastSentAt(), Instant.now())
              .compareTo(HEARTBEAT_INTERVAL)
          >= 0) {
        sendHeartbeat(jobId, subscription);
      }
    }
  }

  private void sendSnapshot(UUID jobId, Subscription subscription, GenerationJob job) {
    JobResponse snapshot = JobResponse.from(job);
    try {
      subscription
          .emitter()
          .send(
              SseEmitter.event()
                  .name("snapshot")
                  .id(eventId(job))
                  .reconnectTime(1_500L)
                  .data(snapshot));
      subscription.markSent(snapshot);
      if (job.getStatus().isTerminal()) {
        remove(jobId, subscription);
        subscription.emitter().complete();
      }
    } catch (IOException | IllegalStateException exception) {
      remove(jobId, subscription);
      log.debug("Generation SSE subscriber disconnected for jobId={}", jobId);
    }
  }

  private void sendHeartbeat(UUID jobId, Subscription subscription) {
    try {
      subscription.emitter().send(SseEmitter.event().name("heartbeat").comment("keep-alive"));
      subscription.markHeartbeat();
    } catch (IOException | IllegalStateException exception) {
      remove(jobId, subscription);
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
    if (jobSubscriptions == null) return;
    jobSubscriptions.remove(subscription);
    if (jobSubscriptions.isEmpty()) subscriptions.remove(jobId, jobSubscriptions);
  }

  private static String eventId(GenerationJob job) {
    return job.getStatus().name()
        + ':'
        + job.getProgress()
        + ':'
        + (job.getCurrentStep() == null ? "" : job.getCurrentStep())
        + ':'
        + job.getRowVersion();
  }

  private static final class Subscription {
    private final String ownerId;
    private final SseEmitter emitter;
    private volatile JobResponse lastSnapshot;
    private volatile Instant lastSentAt = Instant.EPOCH;

    private Subscription(String ownerId, SseEmitter emitter) {
      this.ownerId = ownerId;
      this.emitter = emitter;
    }

    String ownerId() {
      return ownerId;
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
