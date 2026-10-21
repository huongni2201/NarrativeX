package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.ChapterProductionStatusRepository;
import com.narrativex.backend.feature.generation.application.port.out.ChapterProductionStatusRepository.ShotAggregate;
import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository.TakeRecord;
import com.narrativex.backend.feature.generation.application.query.ChapterProductionView;
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
  @Test
  void memoizesEvenMissingVoicesAcrossRepeatedCuesAndVisuals() {
    UUID project = UUID.randomUUID(),
        chapter = UUID.randomUUID(),
        scene = UUID.randomUUID(),
        beat = UUID.randomUUID(),
        speaker = UUID.randomUUID();
    when(storyboardAccess.findChapter(chapter))
        .thenReturn(Optional.of(new ChapterInfo(chapter, UUID.randomUUID(), "Chapter", 0)));
    when(storyboardAccess.findScenes(chapter))
        .thenReturn(List.of(new SceneInfo(scene, 0, "Scene")));
    when(storyboardAccess.findVisualBeats(any()))
        .thenReturn(
            List.of(
                new VisualBeatInfo(
                    UUID.randomUUID(), scene, beat, 0, "First", "Intent", "APPROVED", null, null),
                new VisualBeatInfo(
                    UUID.randomUUID(), scene, beat, 1, "Second", "Intent", "APPROVED", null, null),
                new VisualBeatInfo(
                    UUID.randomUUID(),
                    scene,
                    null,
                    2,
                    "Legacy",
                    "Intent",
                    "APPROVED",
                    null,
                    null)));
    when(storyboardAccess.findAudioCues(List.of(beat)))
        .thenReturn(
            java.util.stream.IntStream.range(0, 100)
                .mapToObj(
                    i ->
                        new StoryboardProductionAccess.AudioCueInfo(
                            UUID.randomUUID(), beat, i, "INNER_MONOLOGUE", speaker))
                .toList());
    when(speakerVoiceAccess.resolveSpeakerVoice(speaker)).thenReturn(Optional.empty());
    var result = useCase.execute(project, chapter);
    verify(speakerVoiceAccess, times(1)).resolveSpeakerVoice(speaker);
    assertThat(result.scenes().getFirst().visualBeats().get(2).audioCues()).isEmpty();
    assertThat(result.scenes().getFirst().visualBeats().getFirst().audioCues())
        .allMatch(c -> !c.voiceReady());
    when(statusRepository.aggregate(project, chapter))
        .thenReturn(new ShotAggregate(0, 0, 0, 0, 0, 0, 0, 0, ""));
    assertThat(useCase.getStatus(project, chapter).voiceReady()).isFalse();
  }

  private final StoryboardProductionAccess storyboardAccess =
      mock(StoryboardProductionAccess.class);
  private final StoryVersionAccess storyVersionAccess = mock(StoryVersionAccess.class);
  private final TakeRepository takeRepository = mock(TakeRepository.class);
  private final SelectedTakeRepository selectedTakeRepository = mock(SelectedTakeRepository.class);
  private final SpeakerVoiceAccess speakerVoiceAccess = mock(SpeakerVoiceAccess.class);
  private final GetProductionTimelineUseCase timeline = mock(GetProductionTimelineUseCase.class);
  private final ChapterProductionStatusRepository statusRepository =
      mock(ChapterProductionStatusRepository.class);

  private final GetChapterProductionUseCase useCase =
      new GetChapterProductionUseCase(
          storyboardAccess,
          storyVersionAccess,
          takeRepository,
          selectedTakeRepository,
          speakerVoiceAccess,
          mock(GetCurrentMediaJobUseCase.class),
          timeline,
          statusRepository,
          new com.narrativex.backend.feature.generation.application.service.TakeQualityReadModel(
              new com.narrativex.backend.feature.generation.application.service
                  .TakeQualityEvaluator()));

  @Test
  void assemblesCompleteProductionResponse() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID sceneId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID storyBeatId = UUID.randomUUID();
    UUID speakerProjectCharacterId = UUID.randomUUID();
    UUID firstCueId = UUID.randomUUID();
    UUID secondCueId = UUID.randomUUID();
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
            storyBeatId,
            1,
            "Beat 1",
            "visual intent",
            "APPROVED",
            null,
            "beat prompt");
    when(storyboardAccess.findVisualBeats(List.of(sceneId))).thenReturn(List.of(vb));
    when(storyboardAccess.findAudioCues(List.of(storyBeatId)))
        .thenReturn(
            List.of(
                new StoryboardProductionAccess.AudioCueInfo(
                    firstCueId,
                    storyBeatId,
                    0,
                    "DIALOGUE",
                    speakerProjectCharacterId,
                    1L,
                    "First line",
                    "DRAFT"),
                new StoryboardProductionAccess.AudioCueInfo(
                    secondCueId,
                    storyBeatId,
                    1,
                    "DIALOGUE",
                    speakerProjectCharacterId,
                    2L,
                    "Second line",
                    "APPROVED")));

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
            "{\"whisperX\":{\"expectedText\":\"Hello\",\"recognizedText\":\"Hello\",\"confidence\":0.95,\"coverage\":1.0,\"timingMatch\":true,\"status\":\"PASSED\"}}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findByShotIds(List.of(shotId))).thenReturn(List.of(take));

    SelectedTake selectedTake = new SelectedTake(shotId, takeId, 0L, 3000L);
    when(selectedTakeRepository.findByShotIds(List.of(shotId))).thenReturn(List.of(selectedTake));

    ChapterProductionView response = useCase.execute(projectId, chapterId);

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
    var cueItems = response.scenes().get(0).visualBeats().get(0).audioCues();
    assertThat(cueItems)
        .extracting(ChapterProductionView.ProductionAudioCueItem::id)
        .containsExactly(firstCueId, secondCueId);
    assertThat(cueItems)
        .extracting(ChapterProductionView.ProductionAudioCueItem::adaptedText)
        .containsExactly("First line", "Second line");
    assertThat(cueItems)
        .extracting(ChapterProductionView.ProductionAudioCueItem::status)
        .containsExactly("DRAFT", "APPROVED");
    assertThat(shotItem.selectedTake()).isNotNull();
    assertThat(shotItem.selectedTake().takeId()).isEqualTo(takeId);
    assertThat(response.selectedShots()).isEqualTo(1);

    when(statusRepository.aggregate(projectId, chapterId))
        .thenReturn(new ShotAggregate(1, 0, 0, 0, 1, 0, 0, 1, "marker"));
    var status = useCase.getStatus(projectId, chapterId);
    assertThat(status).isNotNull();
    assertThat(status.chapterId()).isEqualTo(chapterId);
    assertThat(status.totalShots()).isEqualTo(1);
    assertThat(status.selectedTakeCount()).isEqualTo(1);
    assertThat(status.timelineReady()).isFalse();
    assertThat(status.renderReady()).isFalse();
    assertThat(status.overallProgressPercent()).isEqualTo(100);
  }

  private static final String SPEAKING_SNAPSHOT =
      "{\"schemaVersion\":1,\"inputs\":{\"audioMode\":\"NATIVE_AV\","
          + "\"dialogue\":[{\"speaker\":\"An\",\"text\":\"Hi\"}]}}";
  private static final String SILENT_SHOT_SNAPSHOT =
      "{\"schemaVersion\":1,\"inputs\":{\"audioMode\":\"NATIVE_AV\",\"dialogue\":[]}}";

  private static String measured(double meanY, long silenceMs) {
    return "{\"whisperx\":{\"status\":\"PASSED\"},\"qualityControl\":{\"status\":\"MEASURED\","
        + "\"scorerVersion\":\"FFMPEG_TAKE_QC_V1\",\"freezeHeadMs\":0,\"freezeTotalMs\":0,"
        + "\"motionMean\":3.0,\"sceneCutCount\":0,\"flickerStddev\":0.5,\"blackTotalMs\":0,"
        + "\"silenceTotalMs\":"
        + silenceMs
        + ",\"integratedLufs\":-19.0,\"peakDbfs\":-3.0,\"meanY\":"
        + meanY
        + ",\"meanU\":127.0,\"meanV\":128.0}}";
  }

  @Test
  void takeQualityIsEvaluatedAgainstItsSceneAndDialogue() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID sceneId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID storyBeatId = UUID.randomUUID();
    UUID sequenceId = UUID.randomUUID();
    when(storyboardAccess.findChapter(chapterId))
        .thenReturn(Optional.of(new ChapterInfo(chapterId, UUID.randomUUID(), "Chapter", 1)));
    when(storyboardAccess.findScenes(chapterId))
        .thenReturn(List.of(new SceneInfo(sceneId, 1, "S")));
    when(storyboardAccess.findVisualBeats(List.of(sceneId)))
        .thenReturn(
            List.of(
                new VisualBeatInfo(
                    visualBeatId, sceneId, storyBeatId, 1, "B", "intent", "APPROVED", null, null)));
    when(storyboardAccess.findAudioCues(List.of(storyBeatId)))
        .thenReturn(
            List.of(
                new StoryboardProductionAccess.AudioCueInfo(
                    UUID.randomUUID(), storyBeatId, 0, "DIALOGUE", null, 1L, "Line", "APPROVED")));
    when(storyboardAccess.findSequences(List.of(visualBeatId)))
        .thenReturn(List.of(new ShotSequenceInfo(sequenceId, visualBeatId, 1)));

    // Y of 170 is far from a scene whose other takes sit near 120; the last take was never
    // measured.
    String[] metrics = {
      measured(170, 0),
      measured(120, 4000),
      measured(121, 0),
      measured(122, 0),
      measured(119, 0),
      "{}"
    };
    List<ShotInfo> shots = new java.util.ArrayList<>();
    List<TakeRecord> takes = new java.util.ArrayList<>();
    List<SelectedTake> selections = new java.util.ArrayList<>();
    for (int index = 0; index < metrics.length; index++) {
      UUID shotId = UUID.randomUUID();
      UUID takeId = UUID.randomUUID();
      shots.add(
          new ShotInfo(
              shotId,
              sequenceId,
              index,
              "p",
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
              "READY"));
      takes.add(
          new TakeRecord(
              takeId,
              shotId,
              1,
              "comfyui",
              "ltx",
              GenerationStrategy.TEXT_TO_VIDEO,
              UUID.randomUUID(),
              4000L,
              metrics[index],
              "PASSED",
              null,
              null,
              null,
              "PASSED",
              Instant.now(),
              null,
              null,
              null,
              null,
              SPEAKING_SNAPSHOT,
              null));
      selections.add(new SelectedTake(shotId, takeId, 0L, 3000L));
    }
    List<UUID> shotIds = shots.stream().map(ShotInfo::id).toList();
    when(storyboardAccess.findShotsByChapter(projectId, chapterId)).thenReturn(shots);
    when(takeRepository.findByShotIds(shotIds)).thenReturn(takes);
    when(selectedTakeRepository.findByShotIds(shotIds)).thenReturn(selections);

    var items =
        useCase
            .execute(projectId, chapterId)
            .scenes()
            .getFirst()
            .visualBeats()
            .getFirst()
            .shotSequence()
            .shots()
            .stream()
            .map(shot -> shot.takes().getFirst().quality())
            .toList();

    assertThat(items.get(0).warnings()).extracting("code").containsExactly("COLOR_DRIFT");
    assertThat(items.get(1).warnings()).extracting("code").containsExactly("SILENT_DIALOGUE");
    assertThat(items.get(2).level()).isEqualTo("GOOD");
    assertThat(items.get(3).level()).isEqualTo("GOOD");
    assertThat(items.get(4).level()).isEqualTo("GOOD");
    assertThat(items.get(5).level()).isEqualTo("UNMEASURED");
    assertThat(items.get(5).metrics()).isNull();
  }

  /**
   * One Beat has a dialogue cue, but only the first Shot was generated to speak it. The second Shot
   * is a reaction; its silence must not be graded as missing dialogue, and a take whose snapshot
   * predates the dialogue field must not be graded either way.
   */
  @Test
  void speechIsJudgedFromEachTakesOwnSnapshotNotTheBeatsCues() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID sceneId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID storyBeatId = UUID.randomUUID();
    UUID sequenceId = UUID.randomUUID();
    when(storyboardAccess.findChapter(chapterId))
        .thenReturn(Optional.of(new ChapterInfo(chapterId, UUID.randomUUID(), "Chapter", 1)));
    when(storyboardAccess.findScenes(chapterId))
        .thenReturn(List.of(new SceneInfo(sceneId, 1, "S")));
    when(storyboardAccess.findVisualBeats(List.of(sceneId)))
        .thenReturn(
            List.of(
                new VisualBeatInfo(
                    visualBeatId, sceneId, storyBeatId, 1, "B", "intent", "APPROVED", null, null)));
    when(storyboardAccess.findAudioCues(List.of(storyBeatId)))
        .thenReturn(
            List.of(
                new StoryboardProductionAccess.AudioCueInfo(
                    UUID.randomUUID(), storyBeatId, 0, "DIALOGUE", null, 1L, "Line", "APPROVED")));
    when(storyboardAccess.findSequences(List.of(visualBeatId)))
        .thenReturn(List.of(new ShotSequenceInfo(sequenceId, visualBeatId, 1)));

    String silent = measured(120, 4000);
    // speaking shot, reaction shot, take generated before the snapshot recorded dialogue
    String[] snapshots = {SPEAKING_SNAPSHOT, SILENT_SHOT_SNAPSHOT, "{\"schemaVersion\":1}"};
    List<ShotInfo> shots = new java.util.ArrayList<>();
    List<TakeRecord> takes = new java.util.ArrayList<>();
    for (int index = 0; index < snapshots.length; index++) {
      UUID shotId = UUID.randomUUID();
      shots.add(
          new ShotInfo(
              shotId,
              sequenceId,
              index,
              "p",
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
              "READY"));
      takes.add(
          new TakeRecord(
              UUID.randomUUID(),
              shotId,
              1,
              "comfyui",
              "ltx",
              GenerationStrategy.TEXT_TO_VIDEO,
              UUID.randomUUID(),
              4000L,
              silent,
              "PASSED",
              null,
              null,
              null,
              "PASSED",
              Instant.now(),
              null,
              null,
              null,
              null,
              snapshots[index],
              null));
    }
    List<UUID> shotIds = shots.stream().map(ShotInfo::id).toList();
    when(storyboardAccess.findShotsByChapter(projectId, chapterId)).thenReturn(shots);
    when(takeRepository.findByShotIds(shotIds)).thenReturn(takes);
    when(selectedTakeRepository.findByShotIds(shotIds)).thenReturn(List.of());

    var items =
        useCase
            .execute(projectId, chapterId)
            .scenes()
            .getFirst()
            .visualBeats()
            .getFirst()
            .shotSequence()
            .shots()
            .stream()
            .map(shot -> shot.takes().getFirst().quality())
            .toList();

    assertThat(items.get(0).warnings()).extracting("code").containsExactly("SILENT_DIALOGUE");
    assertThat(items.get(0).speechExpectation()).isEqualTo("EXPECTED");
    assertThat(items.get(1).warnings()).isEmpty();
    assertThat(items.get(1).level()).isEqualTo("GOOD");
    assertThat(items.get(1).speechExpectation()).isEqualTo("NOT_EXPECTED");
    assertThat(items.get(2).warnings()).isEmpty();
    assertThat(items.get(2).speechExpectation()).isEqualTo("UNKNOWN");
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
