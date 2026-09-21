package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.service.SpeakerVoiceResolver;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class VideoGenerationJobHandlerTest {
  private GenerationJobTransactionService transactionService;
  private GenerationExecutionPort executionPort;
  private ComputeArtifactAccess artifactAccess;
  private StoryboardShotAccess storyboardShotAccess;
  private SpeakerVoiceResolver speakerVoiceResolver;
  private VideoGenerationJobHandler handler;

  @BeforeEach
  void setUp() {
    transactionService = mock(GenerationJobTransactionService.class);
    executionPort = mock(GenerationExecutionPort.class);
    artifactAccess = mock(ComputeArtifactAccess.class);
    storyboardShotAccess = mock(StoryboardShotAccess.class);
    speakerVoiceResolver = mock(SpeakerVoiceResolver.class);
    handler =
        new VideoGenerationJobHandler(
            transactionService,
            executionPort,
            artifactAccess,
            storyboardShotAccess,
            speakerVoiceResolver);
  }

  @Test
  void executesVideoTaskSubmissionWithRealShotData() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID shotId = UuidV7.random();

    GenerationJob job =
        GenerationJob.rehydrate(
            jobId,
            0L,
            jobId,
            projectId,
            JobType.CHAPTER_GENERATE,
            JobStatus.QUEUED,
            ResourceClass.GPU_HEAVY,
            0,
            null,
            null,
            null,
            chapterId,
            null,
            1L,
            "hash",
            "Hero runs towards the gate",
            "vi",
            "idemp:1",
            UuidV7.random(),
            1,
            ProductionMode.VIDEO_FIRST,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            null,
            null);

    when(transactionService.claimForSubmission(jobId, "GENERATING_VIDEO"))
        .thenReturn(Optional.of(job));

    StoryboardShotAccess.ShotView shotView =
        new StoryboardShotAccess.ShotView(
            shotId,
            0,
            "Hero leaps over the wall in dramatic slow motion",
            RetentionRole.HOOK,
            "[]",
            "castle_wall",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{\"movement\": \"crane-up\", \"speed\": \"slow\"}",
            "{}",
            5000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.READY);

    when(storyboardShotAccess.requireCurrentShots(projectId, chapterId))
        .thenReturn(List.of(shotView));

    OutputArtifactTargetDto output =
        new OutputArtifactTargetDto(UuidV7.random(), "video", "video/mp4", null);
    when(artifactAccess.createOutput(any(), any(), any(), any())).thenReturn(output);

    ComputeSubmissionReceipt receipt =
        new ComputeSubmissionReceipt(jobId, UuidV7.random(), "ltx:prompt-123", "ACCEPTED", 1L);
    when(executionPort.submitTask(any())).thenReturn(receipt);

    handler.execute(jobId);

    ArgumentCaptor<ComputeTaskRequest> requestCaptor =
        ArgumentCaptor.forClass(ComputeTaskRequest.class);
    verify(executionPort).submitTask(requestCaptor.capture());
    ComputeTaskRequest captured = requestCaptor.getValue();

    assertEquals("video.generate", captured.task().type());
    assertEquals("ltx", captured.model().executor());
    assertEquals("ltx-2.5-nvfp4", captured.model().model());
    assertEquals("1.0", captured.model().revision());
    assertEquals(
        "Hero leaps over the wall in dramatic slow motion", captured.inputs().get("prompt"));
    assertEquals(5000, captured.inputs().get("durationMs"));
    assertNotNull(captured.inputs().get("cameraIntent"));

    verify(transactionService).markSubmitted(any(), any(), any());
  }
}
