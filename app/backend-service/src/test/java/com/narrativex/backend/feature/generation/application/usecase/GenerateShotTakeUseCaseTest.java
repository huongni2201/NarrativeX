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
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.port.in.PromptSettingsAccess;
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
  PromptSettingsAccess promptSettings = mock(PromptSettingsAccess.class);
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
          new NarrativeXLimitsProperties(),
          promptSettings);

  @BeforeEach
  void setup() {
    when(promptSettings.current())
        .thenReturn(PromptSettingsDefaults.settings().withRevision(1));
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

  // ---- Settings -> Prompt: resolve once at admission, freeze, replay without re-resolving ----

  private static final tools.jackson.databind.json.JsonMapper JSON_MAPPER =
      tools.jackson.databind.json.JsonMapper.builder().build();

  private void useStyle(String styleId, long revision) {
    when(promptSettings.current())
        .thenReturn(PromptSettingsDefaults.settings().withActiveStyle(styleId).withRevision(revision));
  }

  private List<String> admittedSnapshots(int expectedCount) {
    var snapshots = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(takes, times(expectedCount))
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
            snapshots.capture(),
            any());
    return snapshots.getAllValues();
  }

  private TakeRepository.TakeRecord takeWith(UUID id, String snapshotJson) {
    return new TakeRepository.TakeRecord(
        id,
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
        snapshotJson,
        null);
  }

  @Test
  void newOperationFreezesTheCurrentStyleAndProvenanceIntoItsSnapshot() {
    useStyle("CINEMATIC_ANIME", 1);
    useCase.execute(new GenerateShotTakeCommand(
        projectId, shotId, null, 7L, null, null, "key-one", "LTX_NATIVE_AV"));
    useStyle("STORYBOOK_WATERCOLOR", 2);
    useCase.execute(new GenerateShotTakeCommand(
        projectId, shotId, null, 7L, null, null, "key-two", "LTX_NATIVE_AV"));

    var snapshots = admittedSnapshots(2);
    var first = JSON_MAPPER.readTree(snapshots.get(0));
    var second = JSON_MAPPER.readTree(snapshots.get(1));

    assertThat(first.at("/context/promptSettings/revision").asText()).isEqualTo("1");
    assertThat(first.at("/context/promptSettings/styleId").asText()).isEqualTo("CINEMATIC_ANIME");
    assertThat(second.at("/context/promptSettings/revision").asText()).isEqualTo("2");
    assertThat(second.at("/context/promptSettings/styleId").asText())
        .isEqualTo("STORYBOOK_WATERCOLOR");
    assertThat(second.at("/context/promptSettings/effectiveHash").asText())
        .isNotEqualTo(first.at("/context/promptSettings/effectiveHash").asText());
    assertThat(first.at("/inputs/prompt").asText()).contains("premium semi-realistic");
    assertThat(second.at("/inputs/prompt").asText())
        .containsIgnoringCase("storybook watercolor")
        .doesNotContain("premium semi-realistic");
    assertThat(second.at("/inputs/negativePrompt").asText())
        .contains(PromptSettingsDefaults.settings().videoNegativePrompt().split(",")[0]);
    // The request fingerprint is settings-independent, so both admissions share it.
    assertThat(second.get("requestFingerprint").asText())
        .isEqualTo(first.get("requestFingerprint").asText());
    assertThat(second.get("inputFingerprint").asText())
        .isNotEqualTo(first.get("inputFingerprint").asText());
  }

  @Test
  void replayAfterASaveReturnsTheOriginalTakeWithoutReadingSettingsAgain() {
    useStyle("CINEMATIC_ANIME", 1);
    var response = useCase.execute(command(null, 55L));
    var job = org.mockito.ArgumentCaptor.forClass(GenerationJob.class);
    verify(jobs).save(job.capture());
    String snapshot = admittedSnapshots(1).getFirst();
    when(jobs.findByIdempotencyKey(any())).thenReturn(Optional.of(job.getValue()));
    when(takes.findByGenerationJobId(any()))
        .thenReturn(Optional.of(takeWith(response.id(), snapshot)));

    // The installation prompt configuration changes after the operation was admitted.
    useStyle("STORYBOOK_WATERCOLOR", 9);
    var replay = useCase.execute(command(null, 55L));

    assertThat(replay.id()).isEqualTo(response.id());
    verify(outbox, times(1)).enqueue(any());
    verify(promptSettings, times(1)).current();
    // A genuinely different request with the same key is still a conflict.
    assertThatThrownBy(() -> useCase.execute(command(null, 56L)))
        .isInstanceOf(ResourceConflictException.class);
  }

  @Test
  void replayOfAnOperationAdmittedBeforePromptSettingsStillMatches() {
    useStyle("CINEMATIC_ANIME", 1);
    var response = useCase.execute(command(null, 55L));
    var job = org.mockito.ArgumentCaptor.forClass(GenerationJob.class);
    verify(jobs).save(job.capture());
    var stored = (tools.jackson.databind.node.ObjectNode) JSON_MAPPER.readTree(admittedSnapshots(1).getFirst());
    // Rewrite the stored snapshot the way an older build wrote it: prompts were part of the
    // request fingerprint and no prompt-settings provenance existed.
    ((tools.jackson.databind.node.ObjectNode) stored.get("context")).remove("promptSettings");
    stored.put(
        "requestFingerprint",
        useCase.legacyFingerprintForStoredPrompts(
            command(null, 55L),
            stored.at("/inputs/prompt").asText(),
            stored.at("/inputs/negativePrompt").asText()));
    when(jobs.findByIdempotencyKey(any())).thenReturn(Optional.of(job.getValue()));
    when(takes.findByGenerationJobId(any()))
        .thenReturn(Optional.of(takeWith(response.id(), JSON_MAPPER.writeValueAsString(stored))));

    useStyle("STORYBOOK_WATERCOLOR", 5);

    assertThat(useCase.execute(command(null, 55L)).id()).isEqualTo(response.id());
    verify(outbox, times(1)).enqueue(any());
  }

  @Test
  void frozenBatchShotKeepsFrozenPromptsEvenAfterSettingsChange() {
    var frozen =
        useCase.freeze(
            command(null, 11L),
            PromptSettingsDefaults.settings().withRevision(1)); // CINEMATIC_ANIME
    useStyle("STORYBOOK_WATERCOLOR", 4);

    useCase.executeFrozen(command(null, 11L), frozen.requestFingerprint(), frozen.inputJson());

    var snapshot = JSON_MAPPER.readTree(admittedSnapshots(1).getFirst());
    assertThat(snapshot.at("/context/promptSettings/revision").asText()).isEqualTo("1");
    assertThat(snapshot.at("/context/promptSettings/styleId").asText())
        .isEqualTo("CINEMATIC_ANIME");
    assertThat(snapshot.at("/inputs/prompt").asText()).contains("premium semi-realistic");
    verify(promptSettings, never()).current();
  }

  @Test
  void frozenBatchShotStillFailsWhenTheShotItselfChanged() {
    var frozen =
        useCase.freeze(command(null, 11L), PromptSettingsDefaults.settings().withRevision(1));
    when(shots.findShotById(projectId, shotId))
        .thenReturn(Optional.of(shot(4000, "A completely different action")));

    assertThatThrownBy(
            () ->
                useCase.executeFrozen(
                    command(null, 11L), frozen.requestFingerprint(), frozen.inputJson()))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("Frozen batch shot inputs changed");
    verify(outbox, never()).enqueue(any());
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
