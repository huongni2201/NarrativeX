package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.TakeResponse;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository.TakeRecord;
import com.narrativex.backend.feature.generation.application.port.out.VideoJobDispatcher;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.AudioCueInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ChapterInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotSequenceInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.VisualBeatInfo;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerateShotTakeUseCaseTest {
  private final StoryboardProductionAccess storyboardAccess =
      mock(StoryboardProductionAccess.class);
  private final SpeakerVoiceAccess speakerVoiceAccess = mock(SpeakerVoiceAccess.class);
  private final TakeRepository takeRepository = mock(TakeRepository.class);
  private final GenerationJobRepository generationJobRepository =
      mock(GenerationJobRepository.class);
  private final VideoJobDispatcher videoJobDispatcher = mock(VideoJobDispatcher.class);

  private final GenerateShotTakeUseCase useCase =
      new GenerateShotTakeUseCase(
          storyboardAccess,
          speakerVoiceAccess,
          takeRepository,
          generationJobRepository,
          videoJobDispatcher);

  @Test
  void generatesShotTakeSuccessfully() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID seqId = UUID.randomUUID();

    when(storyboardAccess.findChapterIdByShotId(projectId, shotId)).thenReturn(chapterId);

    ShotInfo shot =
        new ShotInfo(
            shotId,
            seqId,
            1,
            "Close up hero",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    ChapterInfo chapter = new ChapterInfo(chapterId, storyVersionId, "Chapter 1", 1);
    when(storyboardAccess.findChapter(chapterId)).thenReturn(Optional.of(chapter));
    when(storyboardAccess.findSequenceById(seqId)).thenReturn(Optional.empty());

    when(generationJobRepository.save(any(GenerationJob.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    TakeRecord createdTake =
        new TakeRecord(
            UUID.randomUUID(),
            shotId,
            1,
            "comfyui",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            UUID.randomUUID(),
            4000L,
            "{}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findByShotId(shotId)).thenReturn(List.of(createdTake));

    GenerateShotTakeCommand command =
        new GenerateShotTakeCommand(
            projectId, shotId, GenerationStrategy.TEXT_TO_VIDEO, 12345L, null, null);
    TakeResponse response = useCase.execute(command);

    assertThat(response).isNotNull();
    assertThat(response.shotId()).isEqualTo(shotId);
    assertThat(response.attemptNumber()).isEqualTo(1);
    verify(videoJobDispatcher).dispatch(any(UUID.class));
  }

  @Test
  void blocksWhenUnsupportedStrategyRequested() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    when(storyboardAccess.findChapterIdByShotId(projectId, shotId)).thenReturn(chapterId);

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "Close up hero",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    GenerateShotTakeCommand command =
        new GenerateShotTakeCommand(
            projectId, shotId, GenerationStrategy.MULTI_KEYFRAME, null, null, null);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("UNSUPPORTED_STRATEGY");
  }

  @Test
  void blocksDialogueWhenSpeakerVoiceMissing() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID seqId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID storyBeatId = UUID.randomUUID();
    UUID speakerId = UUID.randomUUID();

    when(storyboardAccess.findChapterIdByShotId(projectId, shotId)).thenReturn(chapterId);

    ShotInfo shot =
        new ShotInfo(
            shotId,
            seqId,
            1,
            "Dialogue hero",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    ShotSequenceInfo seq = new ShotSequenceInfo(seqId, visualBeatId, 1);
    when(storyboardAccess.findSequenceById(seqId)).thenReturn(Optional.of(seq));

    VisualBeatInfo vb =
        new VisualBeatInfo(
            visualBeatId,
            UUID.randomUUID(),
            storyBeatId,
            1,
            "Beat",
            "intent",
            "APPROVED",
            null,
            "prompt");
    when(storyboardAccess.findVisualBeat(visualBeatId)).thenReturn(Optional.of(vb));

    AudioCueInfo cue = new AudioCueInfo(UUID.randomUUID(), storyBeatId, 1, "DIALOGUE", speakerId);
    when(storyboardAccess.findAudioCues(List.of(storyBeatId))).thenReturn(List.of(cue));

    when(speakerVoiceAccess.resolveSpeakerVoice(speakerId)).thenReturn(Optional.empty());

    GenerateShotTakeCommand command =
        new GenerateShotTakeCommand(
            projectId, shotId, GenerationStrategy.TEXT_TO_VIDEO, null, null, null);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("MISSING_VOICE_REFERENCE");
  }

  @Test
  void throwsNotFoundWhenShotMissing() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();

    when(storyboardAccess.findChapterIdByShotId(projectId, shotId)).thenReturn(null);

    GenerateShotTakeCommand command =
        new GenerateShotTakeCommand(
            projectId, shotId, GenerationStrategy.TEXT_TO_VIDEO, null, null, null);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(ResourceNotFoundException.class);
  }
}
