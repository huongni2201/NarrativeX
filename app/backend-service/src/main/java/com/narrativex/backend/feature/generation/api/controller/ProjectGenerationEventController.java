package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.generation.application.service.GenerationJobEventBroadcaster;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Delivers realtime Server-Sent Events (SSE) for generation jobs scoped to a project. */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects")
public class ProjectGenerationEventController {

  private final GenerationJobEventBroadcaster broadcaster;

  @GetMapping(
      value = "/{projectId}/generation/events",
      produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseEntity<SseEmitter> streamProjectEvents(@PathVariable UUID projectId) {
    log.debug("Connecting SSE stream for project {}", projectId);
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noCache())
        .header("X-Accel-Buffering", "no")
        .body(broadcaster.registerClient(projectId));
  }
}
