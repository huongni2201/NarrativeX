package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot;
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
  VoiceReferenceAssetAccess voiceReferenceAssets = mock(VoiceReferenceAssetAccess.class);
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
          takes,
          jobs,
          plans,
          stages,
          outbox,
          catalog,
          new VideoPromptCompiler(JsonMapper.builder().build()),
          new com.narrativex.backend.feature.generation.application.service
              .NativeVideoInputMapper(),
          new NarrativeXLimitsProperties());

  @BeforeEach
  void setup() {
    when(storyboard.findAdmissionContextLocked(projectId, shotId))
        .thenReturn(admissionContext(0, ""));
    when(shots.findShotById(projectId, shotId)).thenReturn(Optional.of(shot(4000, "Hero moves")));
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
                    i.getArgument(2),
                    i.getArgument(3),
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
            "ltx-2.5-22b-distilled-int8",
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
  void blocksAudioFirstBeforeCreatingTakeJobOrOutbox() {
    var audioFirst =
        new GenerateShotTakeCommand(
            projectId, shotId, null, null, null, null, "stable-key", "AUDIO_FIRST");

    assertThatThrownBy(() -> useCase.execute(audioFirst))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("UNSUPPORTED_AUDIO_MODE");

    verify(takes, never())
        .createPending(
            any(), anyInt(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    verify(jobs, never()).save(any());
    verify(outbox, never()).enqueue(any());
  }

  @Test
  void blocksImageToVideoBeforeWrites() {
    var props =
        (com.narrativex.backend.feature.generation.infrastructure.compute.VideoGenerationProperties)
            catalog;
    var orig = props.getSupportedStrategies();
    try {
      props.setSupportedStrategies(
          List.of(GenerationStrategy.TEXT_TO_VIDEO, GenerationStrategy.IMAGE_TO_VIDEO));
      assertThatThrownBy(() -> useCase.execute(command(GenerationStrategy.IMAGE_TO_VIDEO, null)))
          .isInstanceOf(DomainValidationException.class)
          .hasMessageContaining("UNSUPPORTED_STRATEGY");
      verifyNoInteractions(outbox);
    } finally {
      props.setSupportedStrategies(orig);
    }
  }

  @Test
  void blocksReferenceConditioningBeforeWrites() {
    when(storyboard.findAdmissionContextLocked(projectId, shotId))
        .thenReturn(
            admissionContext(0, "")
                .replace(
                    "\"characters\":[]",
                    "\"visualBeatReviewStatus\":\"APPROVED\",\"characters\":[]"));
    when(takes.findReferences(projectId, shotId))
        .thenReturn(
            List.of(
                new TakeInputSnapshot.Reference(
                    UUID.randomUUID(),
                    "character-reference",
                    "a".repeat(64),
                    100,
                    "image/png",
                    1.0)));

    assertThatThrownBy(() -> useCase.execute(command(null, null)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("UNSUPPORTED_REFERENCE_CONDITIONING");

    verify(outbox, never()).enqueue(any());
    verify(jobs, never()).save(any());
    verify(takes, never())
        .createPending(
            any(), anyInt(), any(), any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void unusedVoiceReferenceBytesDoNotBlockNativeAvAdmission() {
    UUID projectCharacterId = UUID.randomUUID();
    UUID characterVersionId = UUID.randomUUID();
    UUID voiceReferenceId = UUID.randomUUID();
    when(storyboard.findAdmissionContextLocked(projectId, shotId))
        .thenReturn(admissionContextWithSpeaker(projectCharacterId, characterVersionId));
    when(voices.resolveSpeakerVoice(projectCharacterId))
        .thenReturn(
            Optional.of(
                new SpeakerVoiceAccess.ResolvedSpeakerVoice(
                    UUID.randomUUID(),
                    "Hero",
                    UUID.randomUUID(),
                    voiceReferenceId,
                    VoiceReferenceScope.PROJECT,
                    "vi",
                    "Central Vietnamese",
                    "Warm, steady voice",
                    "Measured delivery",
                    1,
                    0L)));

    var result = useCase.execute(command(null, null));

    assertThat(result.status()).isEqualTo("PENDING");
    verifyNoInteractions(voiceReferenceAssets);
  }

  @Test
  void blocksDurationOverWorkerLimitBeforeWrites() {
    when(shots.findShotById(projectId, shotId)).thenReturn(Optional.of(shot(10_001, "Hero moves")));

    assertThatThrownBy(() -> useCase.execute(command(null, null)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("INVALID_VIDEO_DURATION");

    verifyNoInteractions(outbox);
    verify(jobs, never()).save(any());
    verify(takes, never())
        .createPending(
            any(), anyInt(), any(), any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void blocksMoreThan32DialogueLinesBeforeWrites() {
    when(storyboard.findAdmissionContextLocked(projectId, shotId))
        .thenReturn(admissionContext(33, "line"));

    assertThatThrownBy(() -> useCase.execute(command(null, null)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("INVALID_DIALOGUE_COUNT");

    verifyNoInteractions(outbox);
    verify(jobs, never()).save(any());
  }

  @Test
  void blocksDialogueTextOverWorkerLimitBeforeWrites() {
    when(storyboard.findAdmissionContextLocked(projectId, shotId))
        .thenReturn(admissionContext(1, "x".repeat(10_001)));

    assertThatThrownBy(() -> useCase.execute(command(null, null)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("INVALID_DIALOGUE_TEXT");

    verifyNoInteractions(outbox);
    verify(jobs, never()).save(any());
  }

  @Test
  void blocksPromptOverWorkerLimitBeforeWrites() {
    when(shots.findShotById(projectId, shotId))
        .thenReturn(Optional.of(shot(4_000, "x".repeat(20_001))));

    assertThatThrownBy(() -> useCase.execute(command(null, null)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("INVALID_PROMPT");

    verifyNoInteractions(outbox);
    verify(jobs, never()).save(any());
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

  private String admissionContext(int cueCount, String cueText) {
    String cues =
        java.util.stream.IntStream.range(0, cueCount)
            .mapToObj(
                index ->
                    "{\"cue_type\":\"NARRATOR\",\"speaker_project_character_id\":null,\"adapted_text\":\""
                        + cueText
                        + "\"}")
            .collect(java.util.stream.Collectors.joining(","));
    return "{\"chapterId\":\""
        + UUID.randomUUID()
        + "\",\"storyVersionId\":\""
        + UUID.randomUUID()
        + "\",\"sourceText\":\"story\",\"chapterRowVersion\":0,\"sourceHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"sourceLanguage\":\"en\",\"storyboardRevisionId\":\"00000000-0000-0000-0000-000000000001\",\"characters\":[],\"cues\":["
        + cues
        + "]}";
  }

  private String admissionContextWithSpeaker(UUID projectCharacterId, UUID characterVersionId) {
    return "{\"projectId\":\""
        + projectId
        + "\",\"chapterId\":\""
        + UUID.randomUUID()
        + "\",\"storyVersionId\":\""
        + UUID.randomUUID()
        + "\",\"sourceText\":\"story\",\"chapterRowVersion\":0,\"sourceHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"sourceLanguage\":\"en\",\"storyboardRevisionId\":\"00000000-0000-0000-0000-000000000001\",\"visualBeatReviewStatus\":\"APPROVED\",\"characters\":[{\"projectCharacterId\":\""
        + projectCharacterId
        + "\",\"characterVersionId\":\""
        + characterVersionId
        + "\",\"status\":\"LOCKED\"}],\"cues\":[{\"cue_type\":\"DIALOGUE\",\"speaker_project_character_id\":\""
        + projectCharacterId
        + "\",\"adapted_text\":\"Hello\"}]}";
  }

  private StoryboardShotAccess.ShotView shot(long durationMs, String purpose) {
    return new StoryboardShotAccess.ShotView(
        shotId,
        0,
        purpose,
        null,
        "[]",
        null,
        "{}",
        "{\"action\":\"" + purpose + "\"}",
        "{}",
        "{\"composition\":\"wide\"}",
        "{\"camera\":\"eye level\"}",
        "{\"subjectMotion\":\"moves\"}",
        "{\"cameraMotion\":\"slow track\"}",
        "{}",
        durationMs,
        GenerationStrategy.TEXT_TO_VIDEO,
        "720p_24fps_standard",
        null,
        null,
        null);
  }
}
