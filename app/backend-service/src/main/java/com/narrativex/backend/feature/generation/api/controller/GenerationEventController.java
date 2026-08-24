package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.in.GenerationEventStream;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class GenerationEventController {
  private final CurrentUserId currentUserId;
  private final GenerationEventStream streamService;

  @GetMapping(value = "/generation-events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseEntity<SseEmitter> stream() {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noCache())
        .header("X-Accel-Buffering", "no")
        .body(streamService.connect(currentUserId.get()));
  }
}
