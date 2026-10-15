package com.narrativex.backend.feature.generation.infrastructure.realtime;

import com.narrativex.backend.feature.generation.application.service.GenerationJobEventBroadcaster;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventStreamService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Fans PostgreSQL {@code NOTIFY} messages out to Desktop SSE clients ({@code
 * narrativex.generation.sse.mode=notify}).
 *
 * <p>The project stream keeps the exact event names and payload of the legacy in-memory
 * broadcaster. Job streams are served by {@link GenerationJobEventStreamService}, which loads the
 * snapshot once per job for all of its subscribers. Every client owns a bounded queue drained on a
 * virtual thread, so a slow client delays only itself and events keep their order.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "narrativex.generation.sse.mode", havingValue = "notify")
public class GenerationEventHub implements GenerationJobEventBroadcaster {
  static final String ANALYSIS_PROGRESS_KIND = "analysis-progress";
  private static final Duration EMITTER_TIMEOUT = Duration.ofMinutes(30);
  private static final long HEARTBEAT_SECONDS = 15;
  private static final int MAX_QUEUED_EVENTS = 256;

  /** Transport seen by the hub; {@link SseEmitter} in production, a fake in tests. */
  interface Channel {
    void send(String name, String id, Object data) throws IOException;

    void comment(String text) throws IOException;

    void complete();
  }

  private record Outbound(String name, String id, Object data, String comment) {}

  static final class Client {
    private final UUID projectId;
    private final Channel channel;
    private final Queue<Outbound> queue = new ConcurrentLinkedQueue<>();
    private final AtomicInteger queued = new AtomicInteger();
    private final AtomicBoolean draining = new AtomicBoolean();
    private volatile boolean closed;

    private Client(UUID projectId, Channel channel) {
      this.projectId = projectId;
      this.channel = channel;
    }
  }

  private final ObjectMapper objectMapper;
  private final GenerationJobEventStreamService jobStreamService;
  private final Map<UUID, Set<Client>> projectClients = new ConcurrentHashMap<>();
  private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
  private final ScheduledExecutorService heartbeat =
      Executors.newSingleThreadScheduledExecutor(
          runnable -> {
            Thread thread = new Thread(runnable, "generation-sse-hub-heartbeat");
            thread.setDaemon(true);
            return thread;
          });

  public GenerationEventHub(
      ObjectMapper objectMapper, GenerationJobEventStreamService jobStreamService) {
    this.objectMapper = objectMapper;
    this.jobStreamService = jobStreamService;
    heartbeat.scheduleAtFixedRate(
        this::sendHeartbeats, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
  }

  @PreDestroy
  void stop() {
    heartbeat.shutdownNow();
    executor.shutdownNow();
  }

  @Override
  public SseEmitter registerClient(UUID projectId) {
    SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT.toMillis());
    Client client = register(projectId, new SseChannel(emitter));
    Runnable cleanup = () -> remove(client);
    emitter.onCompletion(cleanup);
    // Complete on timeout: otherwise Spring dispatches AsyncRequestTimeoutException on a response
    // that is already committed and logs it as a warning.
    emitter.onTimeout(
        () -> {
          cleanup.run();
          emitter.complete();
        });
    emitter.onError(ignored -> cleanup.run());
    return emitter;
  }

  Client register(UUID projectId, Channel channel) {
    Client client = new Client(projectId, channel);
    projectClients.computeIfAbsent(projectId, ignored -> ConcurrentHashMap.newKeySet()).add(client);
    enqueue(
        client,
        new Outbound(
            "connected",
            null,
            Map.of("projectId", projectId.toString(), "status", "CONNECTED"),
            null));
    return client;
  }

  /** Legacy in-process broadcast is replaced by the database notification path. */
  @Override
  public void broadcastJobEvent(GenerationJob job) {}

  /** Handles one raw NOTIFY payload. Malformed payloads are logged and dropped. */
  public void onNotification(String payload) {
    try {
      JsonNode root = objectMapper.readTree(payload);
      if (ANALYSIS_PROGRESS_KIND.equals(text(root, "kind"))) {
        UUID jobId = uuid(root, "jobId");
        if (jobId != null) refreshJobStream(jobId);
        return;
      }
      JsonNode job = root.get("job");
      UUID projectId = uuid(root, "projectId");
      UUID jobId = job == null ? null : uuid(job, "jobId");
      if (projectId == null || jobId == null) {
        log.warn("Ignoring generation notification without project or job id");
        return;
      }
      publishToProject(projectId, jobId, job);
      refreshJobStream(jobId);
    } catch (Exception exception) {
      log.warn("Ignoring malformed generation notification", exception);
    }
  }

  /** Tells every client to refetch: notifications sent while the listener was down are lost. */
  public void resync() {
    Map<String, Object> data = Map.of("reason", "listener-reconnected");
    projectClients.values().forEach(clients -> clients.forEach(c -> enqueue(c, resyncEvent(data))));
    executor.execute(jobStreamService::publishAllChanges);
  }

  int projectKeyCount() {
    return projectClients.size();
  }

  int clientCount(UUID projectId) {
    Set<Client> clients = projectClients.get(projectId);
    return clients == null ? 0 : clients.size();
  }

  private static Outbound resyncEvent(Map<String, Object> data) {
    return new Outbound("resync", null, data, null);
  }

  private void publishToProject(UUID projectId, UUID jobId, JsonNode job) {
    Set<Client> clients = projectClients.get(projectId);
    if (clients == null || clients.isEmpty()) return;

    JobStatus status = status(job);
    Map<String, Object> data = new HashMap<>();
    data.put("jobId", jobId.toString());
    data.put("projectId", projectId.toString());
    data.put("type", orEmpty(text(job, "type")));
    data.put("status", status == null ? orEmpty(text(job, "status")) : status.name());
    data.put("step", orEmpty(text(job, "currentStep")));
    data.put("progress", job.hasNonNull("progress") ? job.get("progress").asInt() : 0);
    data.put("active", status != null && status.isActive());
    data.put("terminal", status != null && status.isTerminal());
    data.put("errorCode", orEmpty(text(job, "errorCode")));
    String eventName =
        status == null
            ? "job.updated"
            : switch (status) {
              case COMPLETED -> "job.completed";
              case FAILED, CANCELED -> "job.failed";
              default -> "job.updated";
            };
    Outbound outbound = new Outbound(eventName, null, Map.copyOf(data), null);
    clients.forEach(client -> enqueue(client, outbound));
  }

  private void refreshJobStream(UUID jobId) {
    executor.execute(
        () -> {
          try {
            jobStreamService.publishChangesFor(jobId);
          } catch (RuntimeException exception) {
            log.warn("Failed to refresh job stream for {}", jobId, exception);
          }
        });
  }

  private void sendHeartbeats() {
    Outbound heartbeat = new Outbound(null, null, null, "keep-alive");
    projectClients.values().forEach(clients -> clients.forEach(c -> enqueue(c, heartbeat)));
  }

  private void enqueue(Client client, Outbound event) {
    if (client.closed) return;
    if (client.queued.get() >= MAX_QUEUED_EVENTS) {
      // The client stopped reading; it reconnects and resyncs on its own.
      close(client);
      return;
    }
    client.queue.add(event);
    client.queued.incrementAndGet();
    scheduleDrain(client);
  }

  private void scheduleDrain(Client client) {
    if (client.draining.compareAndSet(false, true)) {
      try {
        executor.execute(() -> drain(client));
      } catch (RuntimeException rejected) {
        client.draining.set(false);
        close(client);
      }
    }
  }

  private void drain(Client client) {
    try {
      Outbound event;
      while (!client.closed && (event = client.queue.poll()) != null) {
        client.queued.decrementAndGet();
        try {
          if (event.comment() != null) client.channel.comment(event.comment());
          else client.channel.send(event.name(), event.id(), event.data());
        } catch (IOException | IllegalStateException exception) {
          close(client);
          return;
        }
      }
    } finally {
      client.draining.set(false);
      if (!client.closed && !client.queue.isEmpty()) scheduleDrain(client);
    }
  }

  private void close(Client client) {
    if (client.closed) return;
    client.closed = true;
    remove(client);
    client.queue.clear();
    client.queued.set(0);
    try {
      client.channel.complete();
    } catch (RuntimeException ignored) {
      // already closed by the container
    }
  }

  private void remove(Client client) {
    client.closed = true;
    projectClients.computeIfPresent(
        client.projectId,
        (key, clients) -> {
          clients.remove(client);
          return clients.isEmpty() ? null : clients;
        });
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.get(field);
    return value == null || value.isNull() ? null : value.asString();
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static UUID uuid(JsonNode node, String field) {
    String value = text(node, field);
    if (value == null) return null;
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException exception) {
      return null;
    }
  }

  private static JobStatus status(JsonNode job) {
    String value = text(job, "status");
    if (value == null) return null;
    try {
      return JobStatus.valueOf(value);
    } catch (IllegalArgumentException exception) {
      return null;
    }
  }

  private record SseChannel(SseEmitter emitter) implements Channel {
    @Override
    public void send(String name, String id, Object data) throws IOException {
      SseEmitter.SseEventBuilder event = SseEmitter.event().name(name).data(data);
      if (id != null) event.id(id);
      emitter.send(event);
    }

    @Override
    public void comment(String text) throws IOException {
      emitter.send(SseEmitter.event().comment(text));
    }

    @Override
    public void complete() {
      emitter.complete();
    }
  }
}
