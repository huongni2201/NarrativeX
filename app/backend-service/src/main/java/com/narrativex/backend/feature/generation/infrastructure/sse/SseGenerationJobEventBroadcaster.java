package com.narrativex.backend.feature.generation.infrastructure.sse;

import com.narrativex.backend.feature.generation.application.service.GenerationJobEventBroadcaster;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * In-memory SSE event broadcaster per project.
 * Notifies connected Desktop clients of active generation job state transitions.
 */
@Slf4j
@Component
public class SseGenerationJobEventBroadcaster implements GenerationJobEventBroadcaster {
  private static final Long DEFAULT_TIMEOUT = 120_000L; // 2 minutes

  private final Map<UUID, List<SseEmitter>> projectEmitters = new ConcurrentHashMap<>();

  @Override
  public SseEmitter registerClient(UUID projectId) {
    SseEmitter emitter = new SseEmitter(DEFAULT_TIMEOUT);
    List<SseEmitter> emitters =
        projectEmitters.computeIfAbsent(projectId, k -> new CopyOnWriteArrayList<>());
    emitters.add(emitter);

    emitter.onCompletion(
        () -> {
          emitters.remove(emitter);
          log.debug("SSE emitter completed for project {}", projectId);
        });
    emitter.onTimeout(
        () -> {
          emitters.remove(emitter);
          log.debug("SSE emitter timed out for project {}", projectId);
        });
    emitter.onError(
        e -> {
          emitters.remove(emitter);
          log.debug("SSE emitter error for project {}: {}", projectId, e.getMessage());
        });

    try {
      emitter.send(
          SseEmitter.event()
              .name("connected")
              .data(Map.of("projectId", projectId.toString(), "status", "CONNECTED")));
    } catch (IOException e) {
      emitters.remove(emitter);
    }

    return emitter;
  }

  @Override
  public void broadcastJobEvent(GenerationJob job) {
    if (job == null || job.getProjectId() == null) {
      return;
    }
    List<SseEmitter> emitters = projectEmitters.get(job.getProjectId());
    if (emitters == null || emitters.isEmpty()) {
      return;
    }

    Map<String, Object> payload =
        Map.of(
            "jobId", job.getJobId().toString(),
            "projectId", job.getProjectId().toString(),
            "type", job.getType().name(),
            "status", job.getStatus().name(),
            "step", job.getCurrentStep() != null ? job.getCurrentStep() : "",
            "progress", job.getProgress(),
            "active", job.getStatus().isActive(),
            "terminal", job.getStatus().isTerminal(),
            "errorCode", job.getErrorCode() != null ? job.getErrorCode() : "");

    String eventName =
        switch (job.getStatus()) {
          case COMPLETED -> "job.completed";
          case FAILED, CANCELED -> "job.failed";
          default -> "job.updated";
        };

    for (SseEmitter emitter : emitters) {
      try {
        emitter.send(SseEmitter.event().name(eventName).data(payload));
      } catch (Exception e) {
        emitters.remove(emitter);
        log.debug(
            "Removing dead SSE emitter for project {}: {}", job.getProjectId(), e.getMessage());
      }
    }
  }
}
