package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

class GenerationDispatchExecutorTest {
  private GenerationDispatchExecutor executor;

  @AfterEach
  void tearDown() {
    if (executor != null) executor.shutdown();
  }

  private GenerationDispatchExecutor newExecutor(int analysis, int media) {
    var properties = new GenerationDispatchProperties();
    properties.getLanes().setAnalysis(analysis);
    properties.getLanes().setMedia(media);
    properties.setShutdownTimeout(Duration.ofSeconds(2));
    @SuppressWarnings("unchecked")
    ObjectProvider<io.micrometer.core.instrument.MeterRegistry> registry =
        org.mockito.Mockito.mock(ObjectProvider.class);
    executor = new GenerationDispatchExecutor(properties, registry);
    return executor;
  }

  @Test
  void neverRunsMoreTasksThanTheLaneAllows() throws Exception {
    var lanes = newExecutor(1, 2);
    var release = new CountDownLatch(1);
    var started = new CountDownLatch(2);

    assertThat(lanes.trySubmit(DispatchLane.MEDIA, 1, () -> await(started, release))).isTrue();
    assertThat(lanes.trySubmit(DispatchLane.MEDIA, 2, () -> await(started, release))).isTrue();
    assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

    assertThat(lanes.availablePermits(DispatchLane.MEDIA)).isZero();
    assertThat(lanes.trySubmit(DispatchLane.MEDIA, 3, () -> {})).isFalse();
    // A full MEDIA lane must not consume ANALYSIS capacity.
    assertThat(lanes.availablePermits(DispatchLane.ANALYSIS)).isEqualTo(1);

    release.countDown();
    waitUntil(() -> lanes.availablePermits(DispatchLane.MEDIA) == 2);
    assertThat(lanes.isInFlight(1)).isFalse();
  }

  @Test
  void refusesToRunTheSameOutboxRowTwice() throws Exception {
    var lanes = newExecutor(1, 4);
    var release = new CountDownLatch(1);
    var started = new CountDownLatch(1);

    assertThat(lanes.trySubmit(DispatchLane.MEDIA, 7, () -> await(started, release))).isTrue();
    assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

    assertThat(lanes.isInFlight(7)).isTrue();
    assertThat(lanes.trySubmit(DispatchLane.MEDIA, 7, () -> {})).isFalse();
    // The rejected duplicate must give its permit back.
    assertThat(lanes.availablePermits(DispatchLane.MEDIA)).isEqualTo(3);

    release.countDown();
  }

  @Test
  void aFailingTaskStillReleasesItsPermit() throws Exception {
    var lanes = newExecutor(1, 1);

    assertThat(
            lanes.trySubmit(
                DispatchLane.MEDIA,
                1,
                () -> {
                  throw new IllegalStateException("boom");
                }))
        .isTrue();

    waitUntil(() -> lanes.availablePermits(DispatchLane.MEDIA) == 1);
    assertThat(lanes.isInFlight(1)).isFalse();
  }

  @Test
  void batchResumeIsDeduplicatedPerKeyAndUsesTheMediaLane() throws Exception {
    var lanes = newExecutor(1, 2);
    var release = new CountDownLatch(1);
    var started = new CountDownLatch(1);
    var key = UUID.randomUUID();

    assertThat(lanes.trySubmitBatchResume(key, () -> await(started, release))).isTrue();
    assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

    assertThat(lanes.trySubmitBatchResume(key, () -> {})).isFalse();
    assertThat(lanes.active(DispatchLane.MEDIA)).isEqualTo(1);
    assertThat(lanes.active(DispatchLane.ANALYSIS)).isZero();

    release.countDown();
    waitUntil(() -> lanes.active(DispatchLane.MEDIA) == 0);
    assertThat(lanes.trySubmitBatchResume(key, () -> {})).isTrue();
  }

  @Test
  void shutdownWaitsForRunningTasksAndRejectsNewWork() throws Exception {
    var lanes = newExecutor(1, 1);
    var finished = new AtomicInteger();
    var started = new CountDownLatch(1);

    assertThat(
            lanes.trySubmit(
                DispatchLane.MEDIA,
                1,
                () -> {
                  started.countDown();
                  sleep(200);
                  finished.incrementAndGet();
                }))
        .isTrue();
    assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

    lanes.shutdown();

    assertThat(finished.get()).isEqualTo(1);
    assertThat(lanes.trySubmit(DispatchLane.MEDIA, 2, () -> {})).isFalse();
    assertThat(lanes.availablePermits(DispatchLane.MEDIA)).isZero();
  }

  private static void await(CountDownLatch started, CountDownLatch release) {
    started.countDown();
    try {
      release.await(5, TimeUnit.SECONDS);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
    }
  }

  private static void sleep(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
    }
  }

  private static void waitUntil(java.util.function.BooleanSupplier condition)
      throws InterruptedException {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
    while (!condition.getAsBoolean() && System.nanoTime() < deadline) {
      Thread.sleep(10);
    }
    assertThat(condition.getAsBoolean()).isTrue();
  }
}
