package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.ChapterProductionResponse;
import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository.TakeRecord;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ChapterInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.SceneInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotSequenceInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.VisualBeatInfo;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetChapterProductionUseCaseTest {
  private final StoryboardProductionAccess storyboardAccess =
      mock(StoryboardProductionAccess.class);
  private final StoryVersionAccess storyVersionAccess = mock(StoryVersionAccess.class);
  private final TakeRepository takeRepository = mock(TakeRepository.class);
  private final SelectedTakeRepository selectedTakeRepository = mock(SelectedTakeRepository.class);
  private final SpeakerVoiceAccess speakerVoiceAccess = mock(SpeakerVoiceAccess.class);

  private final GetChapterProductionUseCase useCase =
      new GetChapterProductionUseCase(
          storyboardAccess,
          storyVersionAccess,
          takeRepository,
          selectedTakeRepository,
          speakerVoiceAccess);

  @Test
  void assemblesCompleteProductionResponse() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID sceneId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID sequenceId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();

    ChapterInfo chapter = new ChapterInfo(chapterId, storyVersionId, "Chapter 1", 1);
    when(storyboardAccess.findChapter(chapterId)).thenReturn(Optional.of(chapter));

    SceneInfo scene = new SceneInfo(sceneId, 1, "Scene 1");
    when(storyboardAccess.findScenes(chapterId)).thenReturn(List.of(scene));

    VisualBeatInfo vb =
        new VisualBeatInfo(
            visualBeatId,
            sceneId,
            UUID.randomUUID(),
            1,
            "Beat 1",
            "visual intent",
            "APPROVED",
            null,
            "beat prompt");
    when(storyboardAccess.findVisualBeats(List.of(sceneId))).thenReturn(List.of(vb));
    when(storyboardAccess.findAudioCues(any())).thenReturn(List.of());

    ShotSequenceInfo sequence = new ShotSequenceInfo(sequenceId, visualBeatId, 1);
    when(storyboardAccess.findSequences(List.of(visualBeatId))).thenReturn(List.of(sequence));

    ShotInfo shot =
        new ShotInfo(
            shotId,
            sequenceId,
            1,
            "purpose",
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
    when(storyboardAccess.findShotsByChapter(projectId, chapterId)).thenReturn(List.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "comfyui",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            UUID.randomUUID(),
            4000L,
            "{\"whisperX\":{\"expectedText\":\"Hello\",\"recognizedText\":\"Hello\",\"confidence\":0.95,\"coverage\":1.0}}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findByShotIds(List.of(shotId))).thenReturn(List.of(take));

    SelectedTake selectedTake = new SelectedTake(shotId, takeId, 0L, 3000L);
    when(selectedTakeRepository.findByShotIds(List.of(shotId))).thenReturn(List.of(selectedTake));

    ChapterProductionResponse response = useCase.execute(projectId, chapterId);

    assertThat(response).isNotNull();
    assertThat(response.chapterId()).isEqualTo(chapterId);
    assertThat(response.chapterTitle()).isEqualTo("Chapter 1");
    assertThat(response.scenes()).hasSize(1);
    assertThat(response.scenes().get(0).visualBeats()).hasSize(1);

    var shotItem = response.scenes().get(0).visualBeats().get(0).shotSequence().shots().get(0);
    assertThat(shotItem.id()).isEqualTo(shotId);
    assertThat(shotItem.takes()).hasSize(1);
    assertThat(shotItem.takes().get(0).whisperXSummary()).isNotNull();
    assertThat(shotItem.takes().get(0).whisperXSummary().recognizedText()).isEqualTo("Hello");
    assertThat(shotItem.selectedTake()).isNotNull();
    assertThat(shotItem.selectedTake().takeId()).isEqualTo(takeId);
    assertThat(response.selectedShots()).isEqualTo(1);

    var status = useCase.getStatus(projectId, chapterId);
    assertThat(status).isNotNull();
    assertThat(status.chapterId()).isEqualTo(chapterId);
    assertThat(status.totalShots()).isEqualTo(1);
    assertThat(status.selectedTakeCount()).isEqualTo(1);
    assertThat(status.timelineReady()).isTrue();
    assertThat(status.renderReady()).isTrue();
    assertThat(status.overallProgressPercent()).isEqualTo(100);
  }

  @Test
  void throwsNotFoundWhenChapterMissing() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    when(storyboardAccess.findChapter(chapterId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(projectId, chapterId))
        .isInstanceOf(ResourceNotFoundException.class);
  }
}
