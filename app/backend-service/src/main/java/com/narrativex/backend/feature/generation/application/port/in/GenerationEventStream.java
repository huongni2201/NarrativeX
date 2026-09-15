package com.narrativex.backend.feature.generation.application.port.in;

import com.narrativex.backend.feature.generation.application.event.GenerationRealtimeEvent;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface GenerationEventStream {
  SseEmitter connect(String userId);
  SseEmitter connect();

  void publish(GenerationRealtimeEvent event);
}
