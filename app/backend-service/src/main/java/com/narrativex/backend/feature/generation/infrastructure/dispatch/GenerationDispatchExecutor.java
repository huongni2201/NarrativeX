package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Runs dispatch work on virtual threads with a bounded number of in-flight tasks per {@link
 * DispatchLane}. Capacity is claimed with {@code tryAcquire}, never by blocking, so a full lane
 * leaves outbox rows unreserved instead of queueing them in memory.
 */
@Slf4j
@Component
public class GenerationDispatchExecutor {
  private final GenerationDispatchProperties properties;
  private final Map<DispatchLane, Semaphore> permits = new EnumMap<>(DispatchLane.class);
  private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
  private final Set<Long> inFlightOutbox = ConcurrentHashMap.newKeySet();
  private final Set<UUID> inFlightBatches = ConcurrentHashMap.newKeySet();
  private final AtomicBoolean accepting = new AtomicBoolean(true);

  public GenerationDispatchExecutor(
      GenerationDispatchProperties properties, ObjectProvider<MeterRegistry> meterRegistry) {
    this.properties = properties;
    for (DispatchLane lane : DispatchLane.values()) {
      permits.put(lane, new Semaphore(properties.capacity(lane)));
    }
    MeterRegistry registry = meterRegistry.getIfAvailable();
    if (registry != null) {
      for (DispatchLane lane : DispatchLane.values()) {
        Gauge.builder("narrativex.dispatch.lane.active", () -> (double) active(lane))
            .tag("lane", lane.name().toLowerCase())
            .register(registry);
      }
    }
  }

  public int availablePermits(DispatchLane lane) {
    return accepting.get() ? permits.get(lane).availablePermits() : 0;
  }

  public int active(DispatchLane lane) {
    return properties.capacity(lane) - permits.get(lane).availablePermits();
  }

  public boolean isInFlight(long outboxId) {
    return inFlightOutbox.contains(outboxId);
  }

  /**
   * Runs {@code task} on the lane if capacity is free and this outbox row is not already running.
   */
  public boolean trySubmit(DispatchLane lane, long outboxId, Runnable task) {
    if (!accepting.get()) return false;
    Semaphore semaphore = permits.get(lane);
    if (!semaphore.tryAcquire()) return false;
    if (!inFlightOutbox.add(outboxId)) {
      semaphore.release();
      return false;
    }
    try {
      executor.execute(
          () -> {
            try {
              task.run();
            } catch (Throwable failure) {
              log.warn("Dispatch task for outbox event {} failed", outboxId, failure);
            } finally {
              inFlightOutbox.remove(outboxId);
              semaphore.release();
            }
          });
      return true;
    } catch (RejectedExecutionException rejected) {
      inFlightOutbox.remove(outboxId);
      semaphore.release();
      return false;
    }
  }

  /**
   * Runs a batch projection on the MEDIA lane. At most one projection per {@code key} is pending at
   * a time, and a full lane simply drops the request: the periodic scheduler is the safety net.
   */
  public boolean trySubmitBatchResume(UUID key, Runnable task) {
    if (!accepting.get()) return false;
    Semaphore semaphore = permits.get(DispatchLane.MEDIA);
    if (!semaphore.tryAcquire()) return false;
    if (!inFlightBatches.add(key)) {
      semaphore.release();
      return false;
    }
    try {
      executor.execute(
          () -> {
            try {
              task.run();
            } catch (Throwable failure) {
              log.warn("Batch resume for {} failed; the scheduler will retry", key, failure);
            } finally {
              inFlightBatches.remove(key);
              semaphore.release();
            }
          });
      return true;
    } catch (RejectedExecutionException rejected) {
      inFlightBatches.remove(key);
      semaphore.release();
      return false;
    }
  }

  /**
   * Stops accepting work and waits for running tasks. Jobs that outlive the wait keep their outbox
   * reservation, which expires and is recovered per ADR-0003.
   */
  @PreDestroy
  public void shutdown() {
    accepting.set(false);
    executor.shutdown();
    try {
      if (!executor.awaitTermination(
          properties.getShutdownTimeout().toMillis(), TimeUnit.MILLISECONDS)) {
        log.warn(
            "Dispatch executor still has {} outbox task(s) running at shutdown; their reservations will expire",
            inFlightOutbox.size());
        executor.shutdownNow();
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      executor.shutdownNow();
    }
  }
}
