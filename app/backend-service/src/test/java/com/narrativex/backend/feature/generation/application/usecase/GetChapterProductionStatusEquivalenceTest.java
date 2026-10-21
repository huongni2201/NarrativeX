package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess.ResolvedSpeakerVoice;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.port.out.ChapterProductionStatusRepository;
import com.narrativex.backend.feature.generation.application.port.out.ChapterProductionStatusRepository.ShotAggregate;
import com.narrativex.backend.feature.generation.application.port.out.ChapterProductionStatusRepository.ShotStrategyGroup;
import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.AudioCueInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ChapterInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.SceneInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotSequenceInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.VisualBeatInfo;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Runs the previous full implementation ({@code getStatusFull}) and the light one on the same
 * fixture and requires identical results, apart from the new {@code productionSignature}.
 */
class GetChapterProductionStatusEquivalenceTest {
  private final StoryboardProductionAccess storyboardAccess =
      mock(StoryboardProductionAccess.class);
  private final StoryVersionAccess storyVersionAccess = mock(StoryVersionAccess.class);
  private final TakeRepository takeRepository = mock(TakeRepository.class);
  private final SelectedTakeRepository selectedTakeRepository = mock(SelectedTakeRepository.class);
  private final SpeakerVoiceAccess speakerVoiceAccess = mock(SpeakerVoiceAccess.class);
  private final GetProductionTimelineUseCase timeline = mock(GetProductionTimelineUseCase.class);
  private final GetCurrentMediaJobUseCase currentJob = mock(GetCurrentMediaJobUseCase.class);
  private final ChapterProductionStatusRepository statusRepository =
      mock(ChapterProductionStatusRepository.class);
  private final GetChapterProductionUseCase useCase =
      new GetChapterProductionUseCase(
          storyboardAccess,
          storyVersionAccess,
          takeRepository,
          selectedTakeRepository,
          speakerVoiceAccess,
          currentJob,
          timeline,
          statusRepository,
          new com.narrativex.backend.feature.generation.application.service.TakeQualityReadModel(
              new com.narrativex.backend.feature.generation.application.service
                  .TakeQualityEvaluator()));

  private final UUID projectId = UUID.randomUUID();
  private final UUID chapterId = UUID.randomUUID();
  private final UUID sceneId = UUID.randomUUID();

  @Test
  void matchesFullImplementationAcrossFixturesAndTimelineStates() {
    for (boolean includeBlocked : List.of(false, true)) {
      for (boolean allSelected : List.of(false, true)) {
        for (boolean chapterReady : List.of(false, true)) {
          for (boolean projectReady : List.of(false, true)) {
            assertEquivalent(includeBlocked, allSelected, chapterReady, projectReady);
          }
        }
      }
    }
  }

  @Test
  void projectWideRenderFlagIsOnlyComputedWhenTheChapterIsReady() {
    fixture(false, true, false, true);

    var status = useCase.getStatus(projectId, chapterId);

    assertThat(status.timelineReady()).isFalse();
    assertThat(status.renderReady()).isFalse();
    verify(timeline, never()).execute(any());
  }

  @Test
  void productionSignatureChangesWithTheDatabaseMarkerAndIsStableOtherwise() {
    fixture(false, true, true, true);
    var first = useCase.getStatus(projectId, chapterId);
    var again = useCase.getStatus(projectId, chapterId);
    assertThat(first.productionSignature()).isNotBlank().isEqualTo(again.productionSignature());

    ShotAggregate current = statusRepository.aggregate(projectId, chapterId);
    when(statusRepository.aggregate(projectId, chapterId))
        .thenReturn(withMarker(current, "changed"));
    var changed = useCase.getStatus(projectId, chapterId);
    assertThat(changed.productionSignature()).isNotEqualTo(first.productionSignature());
  }

  @Test
  void chapterWithoutScenesReportsAnEmptyStatusWithoutTouchingShotAggregates() {
    when(storyboardAccess.findChapter(chapterId))
        .thenReturn(Optional.of(new ChapterInfo(chapterId, UUID.randomUUID(), "Chapter", 0)));
    when(storyboardAccess.findScenes(chapterId)).thenReturn(List.of());
    when(timeline.executeForChapter(projectId, chapterId)).thenReturn(Optional.empty());

    var light = useCase.getStatus(projectId, chapterId);
    var full = useCase.getStatusFull(projectId, chapterId);

    assertThat(light)
        .usingRecursiveComparison()
        .ignoringFields("productionSignature")
        .isEqualTo(full);
    assertThat(light.totalShots()).isZero();
    verify(statusRepository, never()).aggregate(any(), any());
  }

  private void assertEquivalent(
      boolean includeBlocked, boolean allSelected, boolean chapterReady, boolean projectReady) {
    fixture(includeBlocked, allSelected, chapterReady, projectReady);
    var light = useCase.getStatus(projectId, chapterId);
    var full = useCase.getStatusFull(projectId, chapterId);
    assertThat(light)
        .as(
            "includeBlocked=%s allSelected=%s chapterReady=%s projectReady=%s",
            includeBlocked, allSelected, chapterReady, projectReady)
        .usingRecursiveComparison()
        .ignoringFields("productionSignature")
        .isEqualTo(full);
    assertThat(light.productionSignature()).isNotBlank();
  }

  private static ShotAggregate withMarker(ShotAggregate base, String marker) {
    return new ShotAggregate(
        base.total(),
        base.queued(),
        base.generating(),
        base.validating(),
        base.passed(),
        base.failed(),
        base.manualReview(),
        base.selected(),
        marker);
  }

  private void fixture(
      boolean includeBlocked, boolean allSelected, boolean chapterReady, boolean projectReady) {
    org.mockito.Mockito.reset(
        storyboardAccess,
        storyVersionAccess,
        takeRepository,
        selectedTakeRepository,
        speakerVoiceAccess,
        timeline,
        statusRepository);
    UUID readySpeaker = UUID.randomUUID();
    UUID missingSpeaker = UUID.randomUUID();
    when(storyboardAccess.findChapter(chapterId))
        .thenReturn(Optional.of(new ChapterInfo(chapterId, UUID.randomUUID(), "Chapter", 0)));
    when(storyboardAccess.findScenes(chapterId))
        .thenReturn(List.of(new SceneInfo(sceneId, 0, "Scene")));
    when(speakerVoiceAccess.resolveSpeakerVoice(readySpeaker))
        .thenReturn(
            Optional.of(
                new ResolvedSpeakerVoice(
                    UUID.randomUUID(),
                    "Ready",
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    null,
                    "en",
                    null,
                    "warm voice",
                    null)));
    when(speakerVoiceAccess.resolveSpeakerVoice(missingSpeaker)).thenReturn(Optional.empty());

    UUID storyBeatReady = UUID.randomUUID();
    UUID storyBeatMissingVoice = UUID.randomUUID();
    UUID storyBeatNoCues = UUID.randomUUID();
    List<VisualBeatInfo> beats = new ArrayList<>();
    List<ShotSequenceInfo> sequences = new ArrayList<>();
    List<ShotInfo> shots = new ArrayList<>();
    List<AudioCueInfo> cues = new ArrayList<>();
    Map<UUID, UUID> beatBySequence = new LinkedHashMap<>();

    cues.add(new AudioCueInfo(UUID.randomUUID(), storyBeatReady, 0, "DIALOGUE", readySpeaker));
    cues.add(new AudioCueInfo(UUID.randomUUID(), storyBeatReady, 1, "SFX", null));
    addBeat(
        beats, sequences, shots, beatBySequence, storyBeatReady, 0, 3, null, "QUEUED", "PASSED");
    addBeat(
        beats,
        sequences,
        shots,
        beatBySequence,
        storyBeatNoCues,
        1,
        3,
        GenerationStrategy.TEXT_TO_VIDEO,
        "GENERATING",
        "SELECTED");
    addBeat(
        beats,
        sequences,
        shots,
        beatBySequence,
        null,
        2,
        2,
        GenerationStrategy.TEXT_TO_VIDEO,
        "FAILED",
        "manual_review");
    if (includeBlocked) {
      cues.add(
          new AudioCueInfo(
              UUID.randomUUID(), storyBeatMissingVoice, 0, "DIALOGUE", missingSpeaker));
      addBeat(
          beats,
          sequences,
          shots,
          beatBySequence,
          storyBeatMissingVoice,
          3,
          2,
          GenerationStrategy.TEXT_TO_VIDEO,
          "VALIDATING",
          "READY");
      addBeat(
          beats,
          sequences,
          shots,
          beatBySequence,
          storyBeatNoCues,
          4,
          2,
          GenerationStrategy.IMAGE_TO_VIDEO,
          "READY",
          "READY");
    }
    when(storyboardAccess.findVisualBeats(any())).thenReturn(beats);
    when(storyboardAccess.findAudioCues(any())).thenReturn(cues);
    when(storyboardAccess.findSequences(any())).thenReturn(sequences);
    when(storyboardAccess.findShotsByChapter(projectId, chapterId)).thenReturn(shots);

    List<SelectedTake> selected = new ArrayList<>();
    for (int index = 0; index < shots.size(); index++) {
      if (allSelected || index % 3 == 0) {
        selected.add(new SelectedTake(shots.get(index).id(), UUID.randomUUID(), 0L, 1000L));
      }
    }
    when(takeRepository.findByShotIds(any())).thenReturn(List.of());
    when(selectedTakeRepository.findByShotIds(any())).thenReturn(selected);

    // Light path: what the SQL aggregates would return for the same rows.
    int[] byStatus = new int[6];
    for (ShotInfo shot : shots) {
      switch (shot.status().toUpperCase()) {
        case "QUEUED" -> byStatus[0]++;
        case "GENERATING" -> byStatus[1]++;
        case "VALIDATING" -> byStatus[2]++;
        case "PASSED", "SELECTED" -> byStatus[3]++;
        case "FAILED" -> byStatus[4]++;
        case "MANUAL_REVIEW" -> byStatus[5]++;
        default -> {}
      }
    }
    when(statusRepository.aggregate(projectId, chapterId))
        .thenReturn(
            new ShotAggregate(
                shots.size(),
                byStatus[0],
                byStatus[1],
                byStatus[2],
                byStatus[3],
                byStatus[4],
                byStatus[5],
                selected.size(),
                "marker"));
    Map<String, Integer> groups = new LinkedHashMap<>();
    Map<String, ShotStrategyGroup> groupKeys = new LinkedHashMap<>();
    for (ShotInfo shot : shots) {
      UUID beatId = beatBySequence.get(shot.sequenceId());
      String strategy = shot.generationStrategy() == null ? null : shot.generationStrategy().name();
      String key = beatId + "/" + strategy;
      groups.merge(key, 1, Integer::sum);
      groupKeys.put(key, new ShotStrategyGroup(beatId, strategy, 0));
    }
    List<ShotStrategyGroup> strategyGroups = new ArrayList<>();
    groupKeys.forEach(
        (key, group) ->
            strategyGroups.add(
                new ShotStrategyGroup(group.visualBeatId(), group.strategy(), groups.get(key))));
    when(statusRepository.shotStrategyGroups(projectId, chapterId)).thenReturn(strategyGroups);

    // Timeline: chapter readiness and the project-wide flag are the only inputs.
    var chapterView =
        new ProductionTimelineView.Chapter(
            chapterId,
            0,
            "Chapter",
            1L,
            "h",
            null,
            null,
            0L,
            1000L,
            1000L,
            "audio/a.mp3",
            10L,
            "c",
            null,
            null,
            null,
            "",
            null,
            1,
            1,
            chapterReady);
    when(timeline.executeForChapter(projectId, chapterId)).thenReturn(Optional.of(chapterView));
    when(timeline.execute(projectId))
        .thenReturn(
            new ProductionTimelineView(
                projectId,
                UUID.randomUUID(),
                1000L,
                "16:9",
                projectReady,
                List.of(chapterView),
                List.of()));
  }

  private void addBeat(
      List<VisualBeatInfo> beats,
      List<ShotSequenceInfo> sequences,
      List<ShotInfo> shots,
      Map<UUID, UUID> beatBySequence,
      UUID storyBeatId,
      int order,
      int shotCount,
      GenerationStrategy strategy,
      String firstStatus,
      String secondStatus) {
    UUID beatId = UUID.randomUUID();
    UUID sequenceId = UUID.randomUUID();
    beats.add(
        new VisualBeatInfo(
            beatId, sceneId, storyBeatId, order, "Beat", "intent", "APPROVED", null, null));
    sequences.add(new ShotSequenceInfo(sequenceId, beatId, 0));
    beatBySequence.put(sequenceId, beatId);
    for (int index = 0; index < shotCount; index++) {
      shots.add(
          new ShotInfo(
              UUID.randomUUID(),
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
              strategy,
              "STANDARD",
              index == 0 ? firstStatus : secondStatus));
    }
  }
}
