package com.narrativex.backend.feature.generation.infrastructure.realtime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.event.GenerationRealtimeEvent;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class GenerationEventStreamServiceTest {
  private final GenerationEventStreamService service = new GenerationEventStreamService();

  @BeforeEach
  void stopScheduledHeartbeats() {
    // Drive heartbeats directly so disconnect tests do not depend on timer scheduling.
    service.stop();
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void removesConnectionWhenInitialSendFails(boolean illegalState) throws IOException {
    try (var emitters =
        mockConstruction(
            SseEmitter.class,
            (emitter, context) -> failSendAfterDisconnect(emitter, illegalState))) {
      SseEmitter disconnected = assertDoesNotThrow(service::connect);

      assertEquals(0, activeEmitterCount());
      verify(disconnected, never()).completeWithError(any());
      assertEquals(1, emitters.constructed().size());
    }
  }

  @ParameterizedTest
  @CsvSource({"false,false", "false,true", "true,false", "true,true"})
  void keepsPublishingAfterSubscriberDisconnects(boolean heartbeat, boolean illegalState)
      throws IOException {
    UUID projectId = UUID.randomUUID();
    var event =
        new GenerationRealtimeEvent(
            "event-id",
            projectId,
            JobResponse.from(
                GenerationJob.create(projectId, JobType.CHAPTER_ANALYZE, ResourceClass.FAST_CPU)));
    try (var emitters = mockConstruction(SseEmitter.class)) {
      SseEmitter disconnected = service.connect();
      SseEmitter healthy = service.connect();
      failSendAfterDisconnect(disconnected, illegalState);
      Runnable publish =
          heartbeat
              ? () -> ReflectionTestUtils.invokeMethod(service, "sendHeartbeats")
              : () -> service.publish(event);

      assertDoesNotThrow(publish::run);
      assertEquals(1, activeEmitterCount());
      verify(disconnected, never()).completeWithError(any());
      verify(healthy, times(2)).send(any(SseEmitter.SseEventBuilder.class));

      assertDoesNotThrow(publish::run);
      verify(disconnected, times(2)).send(any(SseEmitter.SseEventBuilder.class));
      verify(healthy, times(3)).send(any(SseEmitter.SseEventBuilder.class));
      assertEquals(2, emitters.constructed().size());
    }
  }

  private int activeEmitterCount() {
    return ((List<?>) ReflectionTestUtils.getField(service, "emitters")).size();
  }

  private static void failSendAfterDisconnect(SseEmitter emitter, boolean illegalState)
      throws IOException {
    Exception sendFailure =
        illegalState
            ? new IllegalStateException("Emitter is closed")
            : new IOException("Broken pipe");
    doThrow(sendFailure).when(emitter).send(any(SseEmitter.SseEventBuilder.class));
    lenient()
        .doThrow(new IllegalStateException("AsyncContext is no longer usable after onError"))
        .when(emitter)
        .completeWithError(any());
  }
}
