package com.narrativex.backend.feature.generation.infrastructure.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import com.narrativex.backend.feature.generation.application.service.GenerationJobEventStreamService;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class GenerationEventHubTest {
  private final GenerationJobEventStreamService jobStreams =
      mock(GenerationJobEventStreamService.class);
  private final GenerationEventHub hub = new GenerationEventHub(new ObjectMapper(), jobStreams);

  @AfterEach
  void tearDown() {
    hub.stop();
  }

  @Test
  void jobNotificationReachesOnlyClientsOfThatProjectWithTheLegacyPayload() {
    UUID projectId = UUID.randomUUID(), otherProject = UUID.randomUUID(), jobId = UUID.randomUUID();
    FakeChannel mine = new FakeChannel(), other = new FakeChannel();
    hub.register(projectId, mine);
    hub.register(otherProject, other);
    awaitEvents(mine, 1);

    hub.onNotification(jobPayload(projectId, jobId, "RUNNING", 42, "Analyzing", null));

    awaitEvents(mine, 2);
    FakeEvent event = mine.events.get(1);
    assertThat(event.name()).isEqualTo("job.updated");
    assertThat(asMap(event.data()))
        .containsEntry("jobId", jobId.toString())
        .containsEntry("projectId", projectId.toString())
        .containsEntry("type", "CHAPTER_ANALYSIS")
        .containsEntry("status", "RUNNING")
        .containsEntry("step", "Analyzing")
        .containsEntry("progress", 42)
        .containsEntry("active", true)
        .containsEntry("terminal", false)
        .containsEntry("errorCode", "");
    assertThat(other.events).extracting(FakeEvent::name).containsExactly("connected");
    verify(jobStreams, timeout(1000)).publishChangesFor(jobId);
  }

  @Test
  void terminalStatusesUseTheLegacyEventNames() {
    UUID projectId = UUID.randomUUID();
    FakeChannel channel = new FakeChannel();
    hub.register(projectId, channel);

    hub.onNotification(jobPayload(projectId, UUID.randomUUID(), "COMPLETED", 100, "Done", null));
    hub.onNotification(jobPayload(projectId, UUID.randomUUID(), "FAILED", 10, "Boom", "E1"));
    hub.onNotification(jobPayload(projectId, UUID.randomUUID(), "CANCELED", 10, "Stop", null));

    awaitEvents(channel, 4);
    assertThat(channel.events)
        .extracting(FakeEvent::name)
        .containsExactly("connected", "job.completed", "job.failed", "job.failed");
    assertThat(asMap(channel.events.get(2).data())).containsEntry("errorCode", "E1");
    assertThat(asMap(channel.events.get(1).data())).containsEntry("terminal", true);
  }

  @Test
  void eventsKeepTheirOrderPerClient() {
    UUID projectId = UUID.randomUUID();
    FakeChannel channel = new FakeChannel();
    hub.register(projectId, channel);

    for (int progress = 1; progress <= 100; progress++) {
      hub.onNotification(jobPayload(projectId, UUID.randomUUID(), "RUNNING", progress, "s", null));
    }

    awaitEvents(channel, 101);
    List<Object> progress =
        channel.events.stream().skip(1).map(e -> (Object) asMap(e.data()).get("progress")).toList();
    List<Object> expected = new ArrayList<>();
    for (int i = 1; i <= 100; i++) expected.add(i);
    assertThat(progress).isEqualTo(expected);
  }

  @Test
  void aSlowClientDoesNotDelayOtherClients() throws Exception {
    UUID projectId = UUID.randomUUID();
    CountDownLatch release = new CountDownLatch(1);
    FakeChannel slow = new FakeChannel(release);
    FakeChannel fast = new FakeChannel();
    hub.register(projectId, slow);
    hub.register(projectId, fast);

    long start = System.nanoTime();
    hub.onNotification(jobPayload(projectId, UUID.randomUUID(), "RUNNING", 5, "s", null));
    awaitEvents(fast, 2);
    long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

    assertThat(elapsedMillis).isLessThan(1000);
    assertThat(slow.events).isEmpty();
    release.countDown();
    awaitEvents(slow, 2);
  }

  @Test
  void aClientThatStopsReadingIsDroppedAndItsProjectKeyRemoved() {
    UUID projectId = UUID.randomUUID();
    CountDownLatch never = new CountDownLatch(1);
    FakeChannel stuck = new FakeChannel(never);
    hub.register(projectId, stuck);
    assertThat(hub.projectKeyCount()).isEqualTo(1);

    for (int i = 0; i < 400; i++) {
      hub.onNotification(jobPayload(projectId, UUID.randomUUID(), "RUNNING", 1, "s", null));
    }

    await().atMost(Duration.ofSeconds(5)).until(() -> hub.projectKeyCount() == 0);
    assertThat(stuck.completed).isTrue();
    never.countDown();
  }

  @Test
  void aFailingChannelIsRemovedAndTheEmptyProjectKeyDisappears() {
    UUID projectId = UUID.randomUUID();
    FakeChannel broken = new FakeChannel();
    broken.failSends = true;

    hub.register(projectId, broken);

    await().atMost(Duration.ofSeconds(5)).until(() -> hub.projectKeyCount() == 0);
    assertThat(hub.clientCount(projectId)).isZero();
  }

  @Test
  void analysisProgressNotificationRefreshesOnlyTheJobStream() {
    UUID projectId = UUID.randomUUID(), jobId = UUID.randomUUID();
    FakeChannel channel = new FakeChannel();
    hub.register(projectId, channel);
    awaitEvents(channel, 1);

    hub.onNotification(
        "{\"kind\":\"analysis-progress\",\"jobId\":\"%s\",\"projectId\":\"%s\"}"
            .formatted(jobId, projectId));

    verify(jobStreams, timeout(1000)).publishChangesFor(jobId);
    assertThat(channel.events).extracting(FakeEvent::name).containsExactly("connected");
  }

  @Test
  void resyncTellsEveryProjectClientAndReevaluatesJobStreams() {
    FakeChannel first = new FakeChannel(), second = new FakeChannel();
    hub.register(UUID.randomUUID(), first);
    hub.register(UUID.randomUUID(), second);

    hub.resync();

    awaitEvents(first, 2);
    awaitEvents(second, 2);
    assertThat(first.events.get(1).name()).isEqualTo("resync");
    assertThat(second.events.get(1).name()).isEqualTo("resync");
    verify(jobStreams, timeout(1000)).publishAllChanges();
  }

  @Test
  void malformedNotificationsAreIgnored() {
    FakeChannel channel = new FakeChannel();
    hub.register(UUID.randomUUID(), channel);

    hub.onNotification("not json");
    hub.onNotification("{}");
    hub.onNotification("{\"projectId\":\"x\",\"job\":{}}");

    awaitEvents(channel, 1);
    assertThat(channel.events).extracting(FakeEvent::name).containsExactly("connected");
  }

  private static String jobPayload(
      UUID projectId, UUID jobId, String status, int progress, String step, String errorCode) {
    return """
        {"eventId":"%s:1","projectId":"%s","job":{"jobId":"%s","type":"CHAPTER_ANALYSIS",\
        "status":"%s","progress":%d,"currentStep":"%s","errorCode":%s}}"""
        .formatted(
            jobId,
            projectId,
            jobId,
            status,
            progress,
            step,
            errorCode == null ? "null" : "\"" + errorCode + "\"");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object data) {
    return (Map<String, Object>) data;
  }

  private static void awaitEvents(FakeChannel channel, int count) {
    await().atMost(Duration.ofSeconds(5)).until(() -> channel.events.size() >= count);
  }

  private record FakeEvent(String name, String id, Object data) {}

  private static final class FakeChannel implements GenerationEventHub.Channel {
    final List<FakeEvent> events = new CopyOnWriteArrayList<>();
    final CountDownLatch gate;
    volatile boolean failSends;
    volatile boolean completed;

    FakeChannel() {
      this(null);
    }

    FakeChannel(CountDownLatch gate) {
      this.gate = gate;
    }

    @Override
    public void send(String name, String id, Object data) throws IOException {
      await();
      if (failSends) throw new IOException("client gone");
      events.add(new FakeEvent(name, id, data));
    }

    @Override
    public void comment(String text) throws IOException {
      await();
      if (failSends) throw new IOException("client gone");
    }

    @Override
    public void complete() {
      completed = true;
    }

    private void await() {
      if (gate == null) return;
      try {
        gate.await();
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
      }
    }
  }
}
