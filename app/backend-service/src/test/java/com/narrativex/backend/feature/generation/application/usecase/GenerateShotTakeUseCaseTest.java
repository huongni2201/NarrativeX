package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.port.out.*;
import com.narrativex.backend.feature.generation.application.service.VideoPromptCompiler;
import com.narrativex.backend.feature.generation.domain.aggregate.*;
import com.narrativex.backend.feature.storyboard.application.port.in.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class GenerateShotTakeUseCaseTest {
  StoryboardProductionAccess storyboard = mock(StoryboardProductionAccess.class);
  StoryboardShotAccess shots = mock(StoryboardShotAccess.class);
  SpeakerVoiceAccess voices = mock(SpeakerVoiceAccess.class);
  TakeRepository takes = mock(TakeRepository.class);
  GenerationJobRepository jobs = mock(GenerationJobRepository.class);
  OperationPlanRepository plans = mock(OperationPlanRepository.class);
  StageAttemptRepository stages = mock(StageAttemptRepository.class);
  GenerationOutboxRepository outbox = mock(GenerationOutboxRepository.class);
  VideoGenerationCatalog catalog =
      new com.narrativex.backend.feature.generation.infrastructure.compute
          .VideoGenerationProperties();
  UUID projectId = UUID.randomUUID(), shotId = UUID.randomUUID();
  GenerateShotTakeUseCase useCase =
      new GenerateShotTakeUseCase(
          storyboard,
          shots,
          voices,
          mock(VoiceReferenceAssetAccess.class),
          takes,
          jobs,
          plans,
          stages,
          outbox,
          catalog,
          new VideoPromptCompiler(JsonMapper.builder().build()),
          new NarrativeXLimitsProperties());

  @BeforeEach
  void setup() {
    when(storyboard.findAdmissionContextLocked(projectId, shotId))
        .thenReturn(
            "{\"chapterId\":\""
                + UUID.randomUUID()
                + "\",\"storyVersionId\":\""
                + UUID.randomUUID()
                + "\",\"sourceText\":\"story\",\"chapterRowVersion\":0,\"sourceHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"sourceLanguage\":\"en\",\"storyboardRevisionId\":\"00000000-0000-0000-0000-000000000001\",\"characters\":[],\"cues\":[]}");
    when(shots.findShotById(projectId, shotId))
        .thenReturn(
            Optional.of(
                new StoryboardShotAccess.ShotView(
                    shotId,
                    1,
                    "Hero moves",
                    null,
                    "[]",
                    null,
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    "{}",
                    4000,
                    GenerationStrategy.TEXT_TO_VIDEO,
                    "720p_24fps_standard",
                    null,
                    null,
                    null)));
    when(plans.save(any()))
        .thenAnswer(
            i -> {
              OperationPlan plan = i.getArgument(0);
              return OperationPlan.rehydrate(
                  UUID.randomUUID(),
                  0L,
                  projectId,
                  plan.getGenerationJobId(),
                  plan.getOperationType(),
                  plan.getScopeId(),
                  plan.getInputFingerprint());
            });
    when(jobs.save(any()))
        .thenAnswer(
            i -> ((GenerationJob) i.getArgument(0)).toBuilder().id(UUID.randomUUID()).build());
    when(takes.createPending(
            any(), anyInt(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
        .thenAnswer(
            i ->
                new TakeRepository.TakeRecord(
                    UUID.randomUUID(),
                    shotId,
                    i.getArgument(1),
                    "ltx",
                    "ltx-2.5-nvfp4",
                    i.getArgument(4),
                    null,
                    null,
                    "{}",
                    "PENDING",
                    null,
                    null,
                    null,
                    "PENDING",
                    Instant.now(),
                    i.getArgument(5),
                    i.getArgument(6),
                    i.getArgument(7),
                    i.getArgument(8),
                    i.getArgument(9),
                    i.getArgument(10)));
  }

  GenerateShotTakeCommand command(GenerationStrategy strategy, Long seed) {
    return new GenerateShotTakeCommand(
        projectId, shotId, strategy, seed, null, null, "stable-key", "LTX_NATIVE_AV");
  }

  @Test
  void createsPendingTakeAndOutboxWithoutExternalIo() {
    var response = useCase.execute(command(null, null));
    assertThat(response.id()).isNotNull();
    assertThat(response.jobId()).isNotNull();
    assertThat(response.status()).isEqualTo("PENDING");
    assertThat(response.sourceDurationMs()).isNull();
    verify(outbox).enqueue(any());
    verify(stages).create(any());
  }

  @Test
  void replaysSameTakeWithoutSecondOutbox() {
    var response = useCase.execute(command(null, 55L));
    var capture = org.mockito.ArgumentCaptor.forClass(GenerationJob.class);
    verify(jobs).save(capture.capture());
    var job = capture.getValue();
    var takeCapture = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(takes)
        .createPending(
            any(),
            anyInt(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            takeCapture.capture(),
            any());
    var existing =
        new TakeRepository.TakeRecord(
            response.id(),
            shotId,
            1,
            "ltx",
            "ltx-2.5-nvfp4",
            GenerationStrategy.TEXT_TO_VIDEO,
            null,
            null,
            "{}",
            "PENDING",
            null,
            null,
            null,
            "PENDING",
            Instant.now(),
            null,
            null,
            null,
            null,
            takeCapture.getValue(),
            null);
    when(jobs.findByIdempotencyKey(any())).thenReturn(Optional.of(job));
    when(takes.findByGenerationJobId(any())).thenReturn(Optional.of(existing));
    assertThat(useCase.execute(command(null, 55L)).id()).isEqualTo(response.id());
    verify(outbox, times(1)).enqueue(any());
    assertThatThrownBy(() -> useCase.execute(command(null, 56L)))
        .isInstanceOf(ResourceConflictException.class);
  }

  @Test
  void blocksUnsupportedStrategyBeforeWrites() {
    assertThatThrownBy(() -> useCase.execute(command(GenerationStrategy.MULTI_KEYFRAME, null)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("UNSUPPORTED_STRATEGY");
    verifyNoInteractions(outbox);
  }

  @Test
  void blocksMissingImageReferenceBeforeWrites() {
    assertThatThrownBy(() -> useCase.execute(command(GenerationStrategy.IMAGE_TO_VIDEO, null)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("MISSING_REFERENCE");
    verifyNoInteractions(outbox);
  }

  @Test
  void abortsWhenTakeInsertFails() {
    when(takes.createPending(
            any(), anyInt(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
        .thenThrow(new IllegalStateException("insert failed"));
    assertThatThrownBy(() -> useCase.execute(command(null, null)))
        .hasMessageContaining("insert failed");
    verifyNoInteractions(stages, outbox);
  }

  @Test
  void requiresStableTransportKey() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GenerateShotTakeCommand(
                        projectId, shotId, null, null, null, null, "", null)))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(storyboard);
  }
}
