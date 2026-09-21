package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.UUID;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Port for broadcasting GenerationJob updates to realtime clients (Desktop SSE). */
public interface GenerationJobEventBroadcaster {

  void broadcastJobEvent(GenerationJob job);

  SseEmitter registerClient(UUID projectId);
}
