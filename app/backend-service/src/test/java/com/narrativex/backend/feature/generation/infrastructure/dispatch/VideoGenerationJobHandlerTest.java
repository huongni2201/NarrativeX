package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeRow;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VideoGenerationJobHandlerTest {
  @Test
  void malformedSnapshotHeaderFailsClosedBeforeExternalSubmit() {
    UUID project = UUID.randomUUID(), chapter = UUID.randomUUID();
    var job =
        GenerationJob.createShotVideoGeneration(
            project, UUID.randomUUID(), chapter, "{\"schemaVersion\":1,", "broken-snapshot");
    when(transactionService.claimForSubmission(job.getJobId(), "GENERATING_VIDEO"))
        .thenReturn(Optional.of(job));
    when(artifactAccess.createOutput(any(), any(), any(), any()))
        .thenReturn(new OutputArtifactTargetDto(UUID.randomUUID(), "video", "video/mp4", null));

    handler.execute(job.getJobId());

    verify(executionPort, never()).submitTask(any());
    verify(transactionService)
        .markSubmissionFailed(
            job.getJobId(), "VIDEO_DISPATCH_ERROR", "Malformed persisted video input");
  }

  @Test
  void frozenSchema11WithoutAudioModeFailsBeforeExternalSubmit() {
    assertInvalidFrozenInputs(Map.of("prompt", "A quiet forest"));
  }

  @Test
  void frozenSchema11AudioFirstFailsBeforeExternalSubmit() {
    assertInvalidFrozenInputs(Map.of("audioMode", "AUDIO_FIRST", "prompt", "A quiet forest"));
  }

  private void assertInvalidFrozenInputs(Map<String, Object> inputs) {
    UUID project = UUID.randomUUID(), chapter = UUID.randomUUID();
    var snapshot =
        new TakeInputSnapshot(
            1,
            UUID.randomUUID(),
            1,
            "request-fingerprint",
            "input-fingerprint",
            "ltx",
            "ltx-2.5-22b-distilled-int8",
            "5e6e71018ee1756ed329b697a7b4aedc934dfce9",
            "video.generate:1.1",
            "720p_24fps_standard",
            "LTX_NATIVE_AV",
            7L,
            Instant.now().plusSeconds(1200),
            Map.of(),
            inputs,
            List.of());
    var json =
        tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(snapshot);
    var job =
        GenerationJob.createShotVideoGeneration(
            project, UUID.randomUUID(), chapter, json, "frozen-invalid-inputs");
    var takeMapper = mock(TakeMapper.class);
    var take = mock(TakeRow.class);
    when(transactionService.claimForSubmission(job.getJobId(), "GENERATING_VIDEO"))
        .thenReturn(Optional.of(job));
    when(takeMapper.findByGenerationJobId(job.getId())).thenReturn(take);
    when(take.getInputFingerprint()).thenReturn("input-fingerprint");
    when(take.getInputSnapshotJson()).thenReturn(json);
    when(artifactAccess.getOrCreateTarget(any(), any(), any(), any(), any()))
        .thenReturn(new OutputArtifactTargetDto(UUID.randomUUID(), "video", "video/mp4", null));

    var handlerWithTake =
        new VideoGenerationJobHandler(
            transactionService, executionPort, artifactAccess, takeMapper);
    handlerWithTake.execute(job.getJobId());

    verify(executionPort, never()).submitTask(any());
    verify(transactionService)
        .markSubmissionFailed(
            job.getJobId(), "VIDEO_DISPATCH_ERROR", "Failed to dispatch frozen video inputs");
  }

  @Test
  void jobWithoutAnAdmittedTakeSnapshotFailsClosedInsteadOfUsingADefaultPrompt() {
    UUID project = UUID.randomUUID(), chapter = UUID.randomUUID();
    var job =
        GenerationJob.createShotVideoGeneration(
            project,
            UUID.randomUUID(),
            chapter,
            "The sign says \"schemaVersion\" in this story.",
            "legacy");
    when(transactionService.claimForSubmission(job.getJobId(), "GENERATING_VIDEO"))
        .thenReturn(Optional.of(job));

    handler.execute(job.getJobId());

    verify(executionPort, never()).submitTask(any());
    verify(transactionService)
        .markSubmissionFailed(
            job.getJobId(),
            "VIDEO_LEGACY_INTENT_UNSUPPORTED",
            "Video job has no admitted Take snapshot");
  }

  private GenerationJobTransactionService transactionService;
  private GenerationExecutionPort executionPort;
  private ComputeArtifactAccess artifactAccess;
  private VideoGenerationJobHandler handler;

  @BeforeEach
  void setUp() {
    transactionService = mock(GenerationJobTransactionService.class);
    executionPort = mock(GenerationExecutionPort.class);
    artifactAccess = mock(ComputeArtifactAccess.class);
    handler =
        new VideoGenerationJobHandler(
            transactionService, executionPort, artifactAccess, mock(TakeMapper.class));
  }
}
