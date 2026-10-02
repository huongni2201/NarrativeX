package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.ChapterProductionResponse;
import com.narrativex.backend.feature.generation.api.response.ChapterProductionStatusResponse;
import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository.TakeRecord;
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
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetChapterProductionUseCase {
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final StoryboardProductionAccess storyboardAccess;
  private final StoryVersionAccess storyVersionAccess;
  private final TakeRepository takeRepository;
  private final SelectedTakeRepository selectedTakeRepository;
  private final SpeakerVoiceAccess speakerVoiceAccess;
  private final GetCurrentMediaJobUseCase getCurrentMediaJobUseCase;

  public GetChapterProductionUseCase(
      StoryboardProductionAccess storyboardAccess,
      StoryVersionAccess storyVersionAccess,
      TakeRepository takeRepository,
      SelectedTakeRepository selectedTakeRepository,
      SpeakerVoiceAccess speakerVoiceAccess) {
    this(
        storyboardAccess,
        storyVersionAccess,
        takeRepository,
        selectedTakeRepository,
        speakerVoiceAccess,
        null);
  }

  @Transactional(readOnly = true)
  public ChapterProductionResponse execute(UUID projectId, UUID chapterId) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(chapterId, "chapterId must not be null");

    ChapterInfo chapter =
        storyboardAccess
            .findChapter(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found: " + chapterId));
    storyVersionAccess.requireStoryVersion(projectId, chapter.storyVersionId());

    List<SceneInfo> sceneRows = storyboardAccess.findScenes(chapterId);
    if (sceneRows.isEmpty()) {
      return new ChapterProductionResponse(
          chapter.id(), chapter.title(), chapter.orderIndex(), 0, 0, 0, 0, "PLANNED", List.of());
    }

    List<UUID> sceneIds = sceneRows.stream().map(SceneInfo::id).toList();
    List<VisualBeatInfo> visualBeatRows = storyboardAccess.findVisualBeats(sceneIds);

    List<UUID> storyBeatIds =
        visualBeatRows.stream()
            .map(VisualBeatInfo::storyBeatId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
    List<AudioCueInfo> audioCueRows = storyboardAccess.findAudioCues(storyBeatIds);

    Map<UUID, List<VisualBeatInfo>> visualsByScene =
        visualBeatRows.stream().collect(Collectors.groupingBy(VisualBeatInfo::sceneId));
    Map<UUID, List<AudioCueInfo>> cuesByBeat =
        audioCueRows.stream().collect(Collectors.groupingBy(AudioCueInfo::storyBeatId));

    // Shot sequences for visual beats
    List<UUID> visualBeatIds = visualBeatRows.stream().map(VisualBeatInfo::id).toList();
    List<ShotSequenceInfo> sequenceRows = storyboardAccess.findSequences(visualBeatIds);
    Map<UUID, ShotSequenceInfo> sequenceByBeatId =
        sequenceRows.stream()
            .collect(Collectors.toMap(ShotSequenceInfo::visualBeatId, s -> s, (s1, s2) -> s1));

    // Shots
    List<ShotInfo> shotRows = storyboardAccess.findShotsByChapter(projectId, chapterId);
    Map<UUID, List<ShotInfo>> shotsBySequenceId =
        shotRows.stream().collect(Collectors.groupingBy(ShotInfo::sequenceId));

    // Takes & SelectedTakes
    List<UUID> shotIds = shotRows.stream().map(ShotInfo::id).toList();
    List<TakeRecord> takeRows =
        shotIds.isEmpty() ? List.of() : takeRepository.findByShotIds(shotIds);
    Map<UUID, List<TakeRecord>> takesByShotId =
        takeRows.stream().collect(Collectors.groupingBy(TakeRecord::shotId));

    List<SelectedTake> selectedTakes =
        shotIds.isEmpty() ? List.of() : selectedTakeRepository.findByShotIds(shotIds);
    Map<UUID, SelectedTake> selectedTakeByShotId =
        selectedTakes.stream()
            .collect(Collectors.toMap(SelectedTake::shotId, s -> s, (s1, s2) -> s1));

    int totalShots = shotRows.size();
    int readyShots = 0;
    int selectedShots = 0;

    List<ChapterProductionResponse.ProductionSceneItem> sceneItems = new ArrayList<>();

    for (SceneInfo scene : sceneRows) {
      List<VisualBeatInfo> sceneVisuals = visualsByScene.getOrDefault(scene.id(), List.of());
      List<ChapterProductionResponse.ProductionVisualBeatItem> beatItems = new ArrayList<>();

      for (VisualBeatInfo vb : sceneVisuals) {
        List<AudioCueInfo> cues =
            vb.storyBeatId() != null
                ? cuesByBeat.getOrDefault(vb.storyBeatId(), List.of())
                : List.of();

        List<ChapterProductionResponse.ProductionAudioCueItem> cueItems = new ArrayList<>();
        boolean dialogueVoiceReady = true;
        boolean anyDialogueNeedsVoice = false;

        for (AudioCueInfo cue : cues) {
          boolean voiceReady = true;
          UUID charId = null;
          UUID profileId = null;
          UUID refAssetId = null;
          String speakerName = null;

          if (cue.speakerProjectCharacterId() != null) {
            var voiceOpt = speakerVoiceAccess.resolveSpeakerVoice(cue.speakerProjectCharacterId());
            if (voiceOpt.isPresent()) {
              var v = voiceOpt.get();
              charId = v.characterId();
              speakerName = v.characterName();
              profileId = v.voiceProfileId();
              refAssetId = v.referenceAssetId();
              voiceReady = refAssetId != null;
            } else {
              voiceReady = false;
            }
          }

          if ("DIALOGUE".equalsIgnoreCase(cue.cueType())
              || "VOICEOVER".equalsIgnoreCase(cue.cueType())) {
            anyDialogueNeedsVoice = true;
            if (!voiceReady) {
              dialogueVoiceReady = false;
            }
          }

          cueItems.add(
              new ChapterProductionResponse.ProductionAudioCueItem(
                  cue.id(),
                  cue.storyBeatId(),
                  cue.orderIndex(),
                  cue.cueType(),
                  cue.speakerProjectCharacterId(),
                  speakerName,
                  null,
                  charId,
                  profileId,
                  refAssetId,
                  voiceReady));
        }

        // Shot Sequence
        ShotSequenceInfo seqRow = sequenceByBeatId.get(vb.id());
        ChapterProductionResponse.ProductionShotSequenceItem seqItem = null;

        if (seqRow != null) {
          List<ShotInfo> sequenceShots = shotsBySequenceId.getOrDefault(seqRow.id(), List.of());
          List<ChapterProductionResponse.ProductionShotItem> shotItems = new ArrayList<>();

          for (ShotInfo shot : sequenceShots) {
            List<TakeRecord> takes = takesByShotId.getOrDefault(shot.id(), List.of());
            SelectedTake sel = selectedTakeByShotId.get(shot.id());

            GenerationStrategy strategy =
                shot.generationStrategy() != null
                    ? shot.generationStrategy()
                    : GenerationStrategy.TEXT_TO_VIDEO;

            // Preflight check
            List<String> blockers = new ArrayList<>();
            List<String> warnings = new ArrayList<>();

            if (strategy == GenerationStrategy.MULTI_KEYFRAME
                || strategy == GenerationStrategy.VIDEO_EXTEND
                || strategy == GenerationStrategy.VIDEO_RETAKE) {
              blockers.add(
                  "UNSUPPORTED_STRATEGY: Strategy "
                      + strategy
                      + " is not supported by current video runtime.");
            }

            if (anyDialogueNeedsVoice && !dialogueVoiceReady) {
              blockers.add(
                  "MISSING_VOICE_REFERENCE: Dialogue shot requires an active character voice profile with reference audio.");
            }

            if (strategy == GenerationStrategy.IMAGE_TO_VIDEO
                && (shot.locationRef() == null || shot.locationRef().isBlank())
                && vb.previewMediaAssetId() == null) {
              warnings.add(
                  "MISSING_REFERENCE_IMAGE: Image-to-video performs best with a reference image or poster frame.");
            }

            boolean shotReady = blockers.isEmpty();
            if (shotReady) {
              readyShots++;
            }
            if (sel != null) {
              selectedShots++;
            }

            ChapterProductionResponse.ProductionSelectedTakeItem selItem =
                sel != null
                    ? new ChapterProductionResponse.ProductionSelectedTakeItem(
                        sel.shotId(), sel.takeId(), sel.sourceInMs(), sel.sourceOutMs())
                    : null;

            List<ChapterProductionResponse.ProductionTakeItem> takeItems =
                takes.stream().map(this::toTakeItem).toList();

            shotItems.add(
                new ChapterProductionResponse.ProductionShotItem(
                    shot.id(),
                    shot.sequenceId(),
                    shot.orderIndex(),
                    shot.narrativePurpose(),
                    shot.retentionRole(),
                    shot.subjects(),
                    shot.locationRef(),
                    shot.startStateJson(),
                    shot.actionJson(),
                    shot.endStateJson(),
                    shot.compositionJson(),
                    shot.cameraJson(),
                    shot.subjectMotionJson(),
                    shot.cameraMotionJson(),
                    shot.environmentMotionJson(),
                    shot.targetDurationMs(),
                    strategy,
                    shot.qualityProfile(),
                    shot.status(),
                    takeItems,
                    selItem,
                    new ChapterProductionResponse.ProductionPreflightItem(
                        shotReady, blockers, warnings)));
          }

          seqItem =
              new ChapterProductionResponse.ProductionShotSequenceItem(
                  seqRow.id(), seqRow.visualBeatId(), seqRow.orderIndex(), shotItems);
        }

        beatItems.add(
            new ChapterProductionResponse.ProductionVisualBeatItem(
                vb.id(),
                vb.sceneId(),
                vb.storyBeatId(),
                vb.orderIndex(),
                vb.title(),
                vb.visualIntent(),
                null,
                null,
                vb.reviewStatus(),
                vb.previewMediaAssetId(),
                vb.prompt(),
                cueItems,
                seqItem));
      }

      sceneItems.add(
          new ChapterProductionResponse.ProductionSceneItem(
              scene.id(), scene.orderIndex(), scene.title(), beatItems));
    }

    int overallProgressPercent =
        totalShots > 0 ? (int) Math.round(((double) selectedShots / totalShots) * 100.0) : 0;
    String status =
        selectedShots == totalShots && totalShots > 0
            ? "READY_FOR_EDITOR"
            : selectedShots > 0 ? "IN_PROGRESS" : "PLANNED";

    return new ChapterProductionResponse(
        chapter.id(),
        chapter.title(),
        chapter.orderIndex(),
        totalShots,
        readyShots,
        selectedShots,
        overallProgressPercent,
        status,
        sceneItems);
  }

  @Transactional(readOnly = true)
  public ChapterProductionStatusResponse getStatus(UUID projectId, UUID chapterId) {
    ChapterProductionResponse production = execute(projectId, chapterId);

    int queuedShots = 0;
    int generatingShots = 0;
    int validatingShots = 0;
    int passedShots = 0;
    int failedShots = 0;
    int blockedShots = 0;
    int manualReviewShots = 0;

    boolean anyScene = !production.scenes().isEmpty();
    boolean storyReady =
        anyScene && production.scenes().stream().anyMatch(s -> !s.visualBeats().isEmpty());
    boolean allDialogueHasVoice = true;
    boolean hasDialogue = false;

    for (var scene : production.scenes()) {
      for (var vb : scene.visualBeats()) {
        for (var cue : vb.audioCues()) {
          if ("DIALOGUE".equalsIgnoreCase(cue.cueType())
              || "VOICEOVER".equalsIgnoreCase(cue.cueType())) {
            hasDialogue = true;
            if (!cue.voiceReady()) {
              allDialogueHasVoice = false;
            }
          }
        }
        if (vb.shotSequence() != null && vb.shotSequence().shots() != null) {
          for (var shot : vb.shotSequence().shots()) {
            if ("QUEUED".equalsIgnoreCase(shot.status())) {
              queuedShots++;
            } else if ("GENERATING".equalsIgnoreCase(shot.status())) {
              generatingShots++;
            } else if ("VALIDATING".equalsIgnoreCase(shot.status())) {
              validatingShots++;
            } else if ("PASSED".equalsIgnoreCase(shot.status())
                || "SELECTED".equalsIgnoreCase(shot.status())) {
              passedShots++;
            } else if ("FAILED".equalsIgnoreCase(shot.status())) {
              failedShots++;
            } else if ("MANUAL_REVIEW".equalsIgnoreCase(shot.status())) {
              manualReviewShots++;
            }

            if (shot.preflight() != null && !shot.preflight().ready()) {
              blockedShots++;
            }
          }
        }
      }
    }

    boolean audioReady = storyReady;
    boolean voiceReady = !hasDialogue || allDialogueHasVoice;
    int totalShots = production.totalShots();
    int selectedTakeCount = production.selectedShots();
    boolean generationReady = totalShots > 0 && blockedShots == 0 && storyReady && voiceReady;
    boolean timelineReady = totalShots > 0 && selectedTakeCount == totalShots;
    boolean renderReady = timelineReady;

    UUID activeJobId = null;
    if (getCurrentMediaJobUseCase != null) {
      try {
        var currentJob = getCurrentMediaJobUseCase.execute(projectId, chapterId);
        if (currentJob != null) {
          activeJobId = currentJob.jobId();
        }
      } catch (Exception ignored) {
      }
    }

    return new ChapterProductionStatusResponse(
        chapterId,
        storyReady,
        audioReady,
        voiceReady,
        totalShots,
        queuedShots,
        generatingShots,
        validatingShots,
        passedShots,
        failedShots,
        blockedShots,
        manualReviewShots,
        selectedTakeCount,
        generationReady,
        timelineReady,
        renderReady,
        production.overallProgressPercent(),
        activeJobId);
  }

  private ChapterProductionResponse.ProductionTakeItem toTakeItem(TakeRecord row) {
    ChapterProductionResponse.WhisperXSummaryItem whisperX =
        extractWhisperXSummary(row.metricsJson());

    return new ChapterProductionResponse.ProductionTakeItem(
        row.id(),
        row.shotId(),
        row.attemptNumber(),
        row.provider(),
        row.model(),
        row.generationMode(),
        row.outputAssetId(),
        row.sourceDurationMs(),
        row.metricsJson(),
        row.validationStatus(),
        row.validationFailureCategory(),
        row.validationFailureReason(),
        row.validationRetryRecommendation(),
        row.status(),
        row.createdAt(),
        whisperX);
  }

  private ChapterProductionResponse.WhisperXSummaryItem extractWhisperXSummary(String metricsJson) {
    if (metricsJson == null || metricsJson.isBlank() || "{}".equals(metricsJson.trim())) {
      return null;
    }
    try {
      Map<String, Object> map =
          JSON.readValue(metricsJson, new TypeReference<Map<String, Object>>() {});
      Object wxObj = map.get("whisperx");
      if (wxObj == null) {
        wxObj = map.get("whisperX");
      }
      if (wxObj instanceof Map<?, ?> wx) {
        String expected = (String) wx.get("expectedText");
        String recognized = (String) wx.get("recognizedText");
        Double cov = wx.get("coverage") instanceof Number n ? n.doubleValue() : null;
        Double conf = wx.get("confidence") instanceof Number n ? n.doubleValue() : null;
        Boolean tm = (Boolean) wx.get("timingMatch");
        String st = (String) wx.get("status");
        return new ChapterProductionResponse.WhisperXSummaryItem(
            expected, recognized, cov, conf, tm, st);
      }
    } catch (Exception ignored) {
    }
    return null;
  }
}
