package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository.FrozenBeatImageInput;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ImageGenerationJobHandlerTest {
  private static final String FINGERPRINT = "a".repeat(64);
  private static final String WIDESCREEN_SETTINGS =
      "{\"aspectRatio\":\"16:9\",\"visualStyle\":\"CINEMATIC\"}";

  private final UUID jobId = UUID.randomUUID();
  private final UUID jobRowId = UUID.randomUUID();
  private final UUID planId = UUID.randomUUID();
  private final UUID visualBeatId = UUID.randomUUID();

  private GenerationJobTransactionService transactionService;
  private GenerationExecutionPort executionPort;
  private MediaGenerationItemRepository itemRepository;
  private MediaPlanRepository planRepository;
  private ImageGenerationJobHandler handler;

  @BeforeEach
  void setUp() {
    transactionService = mock(GenerationJobTransactionService.class);
    executionPort = mock(GenerationExecutionPort.class);
    ComputeArtifactAccess artifactAccess = mock(ComputeArtifactAccess.class);
    itemRepository = mock(MediaGenerationItemRepository.class);
    planRepository = mock(MediaPlanRepository.class);
    handler =
        new ImageGenerationJobHandler(
            transactionService, executionPort, artifactAccess, itemRepository, planRepository);

    GenerationJob job = mock(GenerationJob.class);
    when(job.getJobId()).thenReturn(jobId);
    when(job.getId()).thenReturn(jobRowId);
    when(job.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(job.getMediaPlanId()).thenReturn(planId);
    when(transactionService.claimForSubmission(jobId, "GENERATING_MEDIA"))
        .thenReturn(Optional.of(job));
    when(artifactAccess.createOutput(any(), any(), any(), any()))
        .thenReturn(new OutputArtifactTargetDto(UUID.randomUUID(), "image", "image/png", null));
    when(executionPort.submitTask(any()))
        .thenReturn(
            new ComputeSubmissionReceipt(jobId, UUID.randomUUID(), "handle", "ACCEPTED", 1L));
  }

  @Test
  void submitsTheFrozenVisualBeatPromptAndSizeNotFixedDefaults() {
    givenSingleAttempt();
    when(planRepository.findFrozenBeatImageInput(planId, visualBeatId))
        .thenReturn(
            Optional.of(
                new FrozenBeatImageInput(
                    "a lighthouse at dusk", "blurry, low quality", WIDESCREEN_SETTINGS)));

    handler.execute(jobId);

    ArgumentCaptor<ComputeTaskRequest> request = ArgumentCaptor.forClass(ComputeTaskRequest.class);
    verify(executionPort).submitTask(request.capture());
    Map<String, Object> inputs = request.getValue().inputs();
    assertEquals(Set.of("prompt", "negativePrompt", "width", "height", "seed"), inputs.keySet());
    assertEquals("a lighthouse at dusk", inputs.get("prompt"));
    assertEquals("blurry, low quality", inputs.get("negativePrompt"));
    assertEquals(1344, inputs.get("width"));
    assertEquals(768, inputs.get("height"));
    assertTrue((Integer) inputs.get("seed") > 0);
    verify(transactionService, never()).markSubmissionFailed(any(), any(), any());
  }

  @Test
  void refusesToSubmitAJobThatDoesNotTargetExactlyOneVisualBeat() {
    when(itemRepository.findByJobId(jobRowId))
        .thenReturn(List.of(attemptFor(UUID.randomUUID()), attemptFor(UUID.randomUUID())));

    handler.execute(jobId);

    verify(executionPort, never()).submitTask(any());
    verify(transactionService)
        .markSubmissionFailed(eq(jobId), eq("IMAGE_SCOPE_UNSUPPORTED"), anyString());
  }

  @Test
  void failsWithoutSubmittingWhenTheFrozenPromptIsMissing() {
    givenSingleAttempt();
    when(planRepository.findFrozenBeatImageInput(planId, visualBeatId))
        .thenReturn(Optional.empty());

    handler.execute(jobId);

    verify(executionPort, never()).submitTask(any());
    verify(transactionService)
        .markSubmissionFailed(eq(jobId), eq("IMAGE_INPUT_MISSING"), anyString());
  }

  @Test
  void failsWithoutSubmittingWhenTheFrozenAspectRatioIsUnsupported() {
    givenSingleAttempt();
    when(planRepository.findFrozenBeatImageInput(planId, visualBeatId))
        .thenReturn(
            Optional.of(
                new FrozenBeatImageInput(
                    "a lighthouse at dusk", "blurry", "{\"aspectRatio\":\"2:1\"}")));

    handler.execute(jobId);

    verify(executionPort, never()).submitTask(any());
    verify(transactionService)
        .markSubmissionFailed(eq(jobId), eq("IMAGE_INPUT_INVALID"), anyString());
  }

  private void givenSingleAttempt() {
    when(itemRepository.findByJobId(jobRowId)).thenReturn(List.of(attemptFor(visualBeatId)));
  }

  private MediaGenerationItem attemptFor(UUID beatId) {
    return MediaGenerationItem.create(jobRowId, planId, beatId, "beat-" + beatId, 1, FINGERPRINT);
  }
}
