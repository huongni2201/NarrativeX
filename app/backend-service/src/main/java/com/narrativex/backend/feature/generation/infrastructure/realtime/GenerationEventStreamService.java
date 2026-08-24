package com.narrativex.backend.feature.generation.infrastructure.realtime;

import com.narrativex.backend.feature.generation.application.event.GenerationRealtimeEvent;
import com.narrativex.backend.feature.generation.application.port.in.GenerationEventStream;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Slf4j
@Service
public class GenerationEventStreamService implements GenerationEventStream {
  private static final long SSE_TIMEOUT_MILLIS = Duration.ofMinutes(30).toMillis();
  private static final long HEARTBEAT_SECONDS = 15;

  private final Map<String, CopyOnWriteArrayList<SseEmitter>> emittersByUser =
      new ConcurrentHashMap<>();
  private final ScheduledExecutorService heartbeatExecutor =
      Executors.newSingleThreadScheduledExecutor(
          runnable -> {
            Thread thread = new Thread(runnable, "generation-sse-heartbeat");
            thread.setDaemon(true);
            return thread;
          });

  public GenerationEventStreamService() {
    heartbeatExecutor.scheduleAtFixedRate(
        this::sendHeartbeats, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
  }

  @PreDestroy
  void stop() {
    heartbeatExecutor.shutdownNow();
  }

  public SseEmitter connect(String userId) {
    SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MILLIS);
    emittersByUser.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
    Runnable cleanup = () -> remove(userId, emitter);
    emitter.onCompletion(cleanup);
    emitter.onTimeout(cleanup);
    emitter.onError(ignored -> cleanup.run());
    try {
      emitter.send(
          SseEmitter.event().name("generation.connected").data(Map.of("status", "CONNECTED")));
    } catch (IOException exception) {
      remove(userId, emitter);
      emitter.completeWithError(exception);
    }
    return emitter;
  }

  public void publish(GenerationRealtimeEvent event) {
    var emitters = emittersByUser.get(event.userId());
    if (emitters == null) return;

    for (SseEmitter emitter : emitters) {
      try {
        emitter.send(
            SseEmitter.event()
                .id(event.eventId())
                .name("generation.updated")
                .data(event.response()));
      } catch (IOException | IllegalStateException exception) {
        remove(event.userId(), emitter);
        emitter.completeWithError(exception);
      }
    }
  }

  private void sendHeartbeats() {
    emittersByUser.forEach(
        (userId, emitters) -> {
          for (SseEmitter emitter : emitters) {
            try {
              emitter.send(SseEmitter.event().comment("keep-alive"));
            } catch (IOException | IllegalStateException exception) {
              remove(userId, emitter);
              emitter.completeWithError(exception);
            }
          }
        });
  }

  private void remove(String userId, SseEmitter emitter) {
    var emitters = emittersByUser.get(userId);
    if (emitters == null) return;
    emitters.remove(emitter);
    if (emitters.isEmpty()) emittersByUser.remove(userId, emitters);
  }
}
