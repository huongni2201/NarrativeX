package com.narrativex.backend.feature.generation.infrastructure.compute;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.ArtifactReadAccessDto;
import com.narrativex.backend.feature.generation.application.model.compute.ArtifactWriteAccessDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.InputArtifactRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.domain.enums.AlignmentStatus;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocument;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocumentChapter;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationSetSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationTimeline;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ComputeNarrationAlignmentAdapterTest {

  @Test
  void alignsDocumentAndNarrationSuccessfully() {
    GenerationExecutionPort executionPort = mock(GenerationExecutionPort.class);
    ComputeArtifactAccess artifactAccess = mock(ComputeArtifactAccess.class);
    UUID inputId = UuidV7.random();
    UUID outputId = UuidV7.random();
    OutputArtifactTargetDto output =
        new OutputArtifactTargetDto(
            outputId,
            "alignment",
            "application/json",
            new ArtifactWriteAccessDto(
                "PUT",
                "https://example.com/output.json",
                Instant.now().plusSeconds(300),
                Map.of()));
    when(artifactAccess.createInput(any(UUID.class), any(UUID.class), any(String.class)))
        .thenReturn(
            new InputArtifactRefDto(
                inputId,
                "source-audio",
                "audio/wav",
                4,
                "d".repeat(64),
                new ArtifactReadAccessDto(
                    "GET",
                    "https://example.com/input.wav",
                    Instant.now().plusSeconds(300),
                    Map.of())));
    when(artifactAccess.createOutput(
            any(UUID.class), any(UUID.class), any(String.class), any(String.class)))
        .thenReturn(output);
    when(artifactAccess.readOutput(output))
        .thenReturn(
            ("[{\"index\":0,\"textStart\":0,\"textEnd\":3,\"audioStartMs\":100,"
                    + "\"audioEndMs\":300,\"confidence\":0.99},"
                    + "{\"index\":1,\"textStart\":4,\"textEnd\":8,\"audioStartMs\":350,"
                    + "\"audioEndMs\":600,\"confidence\":0.98},"
                    + "{\"index\":2,\"textStart\":9,\"textEnd\":12,\"audioStartMs\":650,"
                    + "\"audioEndMs\":800,\"confidence\":0.97},"
                    + "{\"index\":3,\"textStart\":13,\"textEnd\":17,\"audioStartMs\":820,"
                    + "\"audioEndMs\":1100,\"confidence\":0.96}]")
                .getBytes());
    when(executionPort.submitTask(any(ComputeTaskRequest.class)))
        .thenAnswer(
            invocation -> {
              ComputeTaskRequest req = invocation.getArgument(0);
              return new com.narrativex.backend.feature.generation.application.model.compute
                  .ComputeSubmissionReceipt(
                  req.taskId(), req.attemptId(), "whisperx:handle", "ACCEPTED", 1L);
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
                    List.of(
                        new ProducedArtifactDto(
                            outputId, "alignment", "application/json", 256, "a".repeat(64))),
                    null,
                    null));

    ComputeNarrationAlignmentAdapter adapter =
        new ComputeNarrationAlignmentAdapter(executionPort, artifactAccess);

    UUID docId = UuidV7.random();
    UUID setId = UuidV7.random();
    String docFingerprint = "a".repeat(64);
    String narrationHash = "b".repeat(64);

    NarrationDocumentChapter chapter =
        new NarrationDocumentChapter(
            UuidV7.random(), UuidV7.random(), 0, 0, 100, "c".repeat(64), 0L);
    NarrationDocument doc =
        new NarrationDocument(
            docId, UuidV7.random(), docFingerprint, List.of(chapter), "xin chào thế giới");
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
    assertEquals(1, timeline.spans().size());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
  }
}
