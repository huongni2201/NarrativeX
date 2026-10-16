package com.narrativex.backend.feature.generation.application.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@ExtendWith(MockitoExtension.class)
class GenerationJobEventStreamServiceTest {
  @Mock private GenerationJobRepository generationJobRepository;
  @InjectMocks private GenerationJobEventStreamService service;

  @Test
  void rejectsSubscriptionWhenJobNotFound() {
    UUID jobId = UuidV7.random();
    when(generationJobRepository.findByJobId(jobId)).thenReturn(Optional.empty());

    assertThrows(ResourceNotFoundException.class, () -> service.subscribe(jobId));
    assertEquals(0, service.activeSubscriptionCount());
  }

  @Test
  void removesSubscriberWhenWatchedJobBecomesTerminal() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    GenerationJob running = job(jobId, projectId, JobStatus.RUNNING, 25, 0L);
    GenerationJob completed = job(jobId, projectId, JobStatus.COMPLETED, 100, 1L);

    when(generationJobRepository.findByJobId(jobId))
        .thenReturn(Optional.of(running), Optional.of(completed));
    service.subscribe(jobId);
    assertEquals(1, service.activeSubscriptionCount());

    service.publishChanges();

    assertEquals(0, service.activeSubscriptionCount());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void removesDisconnectedSubscriberWithoutRedispatchingSnapshotError(boolean illegalState)
      throws IOException {
    assertDisconnectedSubscriberIsRemoved(false, illegalState);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void removesDisconnectedSubscriberWithoutRedispatchingHeartbeatError(boolean illegalState)
      throws IOException {
    assertDisconnectedSubscriberIsRemoved(true, illegalState);
  }

  private void assertDisconnectedSubscriberIsRemoved(boolean heartbeat, boolean illegalState)
      throws IOException {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    GenerationJob running = job(jobId, projectId, JobStatus.RUNNING, 25, 0L);
    GenerationJob updated = running.toBuilder().progress(50).build();
    when(generationJobRepository.findByJobId(jobId)).thenReturn(Optional.of(running));

    try (var emitters = mockConstruction(SseEmitter.class)) {
      SseEmitter disconnected = service.subscribe(jobId);
      SseEmitter healthy = service.subscribe(jobId);
      if (heartbeat) {
        var subscriptions = (Map<?, ?>) ReflectionTestUtils.getField(service, "subscriptions");
        for (Object subscription : (List<?>) subscriptions.get(jobId)) {
          ReflectionTestUtils.setField(subscription, "lastSentAt", Instant.EPOCH);
        }
      } else {
        when(generationJobRepository.findByJobId(jobId)).thenReturn(Optional.of(updated));
      }

      Exception sendFailure =
          illegalState
              ? new IllegalStateException("Emitter is closed")
              : new IOException("Broken pipe");
      doThrow(sendFailure).when(disconnected).send(any(SseEmitter.SseEventBuilder.class));
      // Model Tomcat rejecting a second dispatch after AsyncListener.onError has returned.
      org.mockito.Mockito.lenient()
          .doThrow(new IllegalStateException("AsyncContext is no longer usable after onError"))
          .when(disconnected)
          .completeWithError(any());

      assertDoesNotThrow(service::publishChanges);
      assertEquals(1, service.activeSubscriptionCount());
      verify(disconnected, never()).completeWithError(any());
      verify(healthy, times(2)).send(any(SseEmitter.SseEventBuilder.class));

      assertDoesNotThrow(service::publishChanges);
      verify(disconnected, times(2)).send(any(SseEmitter.SseEventBuilder.class));
      assertEquals(2, emitters.constructed().size());
    }
  }

  private static GenerationJob job(
      UUID jobId, UUID projectId, JobStatus status, int progress, long rowVersion) {
    return GenerationJob.rehydrate(
        UuidV7.random(),
        rowVersion,
        jobId,
        projectId,
        JobType.CHAPTER_ANALYZE,
        status,
        ResourceClass.FAST_CPU,
        progress,
        status == JobStatus.COMPLETED ? "DONE" : "ANALYZING",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }
}
