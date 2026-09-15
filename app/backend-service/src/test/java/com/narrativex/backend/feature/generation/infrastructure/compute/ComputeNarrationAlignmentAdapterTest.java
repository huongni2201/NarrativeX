package com.narrativex.backend.feature.generation.infrastructure.compute;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.SubmitTaskResult;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.domain.enums.AlignmentStatus;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocument;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocumentChapter;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationSetSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationTimeline;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ComputeNarrationAlignmentAdapterTest {

  @Test
  void alignsDocumentAndNarrationSuccessfully() {
    GenerationExecutionPort executionPort = mock(GenerationExecutionPort.class);
    when(executionPort.submitTask(any(ComputeTaskRequest.class)))
        .thenAnswer(
            invocation -> {
              ComputeTaskRequest req = invocation.getArgument(0);
              return new SubmitTaskResult(req.taskId(), req.attemptId(), "ACCEPTED");
            });

    when(executionPort.queryTask(any(UUID.class), any(UUID.class)))
        .thenAnswer(
            invocation ->
                new ComputeObservationDto(
                    "1.0",
                    invocation.getArgument(0),
                    invocation.getArgument(1),
                    "SUCCEEDED",
                    1,
                    Instant.now(),
                    "whisperx:handle",
                    1.0,
                    List.of(),
                    null,
                    null));

    ComputeNarrationAlignmentAdapter adapter =
        new ComputeNarrationAlignmentAdapter(executionPort);

    UUID docId = UuidV7.random();
    UUID setId = UuidV7.random();
    String docFingerprint = "a".repeat(64);
    String narrationHash = "b".repeat(64);

    NarrationDocumentChapter chapter =
        new NarrationDocumentChapter(
            UuidV7.random(), UuidV7.random(), 0, 0, 100, "c".repeat(64), 0L);
    NarrationDocument doc =
        new NarrationDocument(docId, UuidV7.random(), docFingerprint, List.of(chapter));
    NarrationSetSnapshot narration =
        new NarrationSetSnapshot(
            setId,
            narrationHash,
            List.of(new NarrationPartSnapshot(UuidV7.random(), 0, "d".repeat(64), 5000L)));

    NarrationTimeline timeline = adapter.align(doc, narration);

    assertNotNull(timeline);
    assertEquals(docId, timeline.narrationDocumentId());
    assertEquals(setId, timeline.narrationSetId());
    assertEquals(5000L, timeline.totalDurationMs());
    assertEquals(AlignmentStatus.READY, timeline.status());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
  }
}
