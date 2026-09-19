package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.api.response.ChapterStoryResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterStoryReadRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.VisualBeatPromptProvider;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AudioCueRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryBeatRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterStoryQueryAdapter implements ChapterStoryReadRepository {
  private final ChapterRepository chapterRepository;
  private final StoryboardMapper storyboardMapper;
  private final StoryboardRepository storyboardRepository;
  private final VisualBeatPromptProvider visualBeatPromptProvider;

  @Override
  public ChapterStoryResponse get(UUID projectId, UUID chapterId) {
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));

    List<SceneRow> scenes = storyboardMapper.findCurrentScenes(chapterId);
    if (scenes.isEmpty()) {
      return new ChapterStoryResponse(
          chapter.getId(),
          chapter.getTitle(),
          chapter.getOrderIndex(),
          null,
          List.of());
    }

    List<UUID> sceneIds = scenes.stream().map(SceneRow::getId).toList();
    List<StoryBeatRow> storyBeatRows = storyboardMapper.findStoryBeats(sceneIds);
    List<UUID> storyBeatIds = storyBeatRows.stream().map(StoryBeatRow::getId).toList();

    List<AudioCueRow> audioCueRows =
        storyBeatIds.isEmpty() ? List.of() : storyboardMapper.findAudioCues(storyBeatIds);
    List<VisualBeatRow> visualBeatRows = storyboardMapper.findVisualBeats(sceneIds);

    // Grouping
    Map<UUID, List<StoryBeatRow>> beatsByScene =
        storyBeatRows.stream().collect(Collectors.groupingBy(StoryBeatRow::getSceneId));
    Map<UUID, List<AudioCueRow>> cuesByBeat =
        audioCueRows.stream().collect(Collectors.groupingBy(AudioCueRow::getStoryBeatId));
    Map<UUID, List<VisualBeatRow>> visualsByBeat =
        visualBeatRows.stream()
            .filter(v -> v.getStoryBeatId() != null)
            .collect(Collectors.groupingBy(VisualBeatRow::getStoryBeatId));
    Map<UUID, List<VisualBeatRow>> unassignedVisualsByScene =
        visualBeatRows.stream()
            .filter(v -> v.getStoryBeatId() == null)
            .collect(Collectors.groupingBy(VisualBeatRow::getSceneId));

    // Resolve prompts
    List<VisualBeat> domainVisualBeats = storyboardRepository.findVisualBeatsBySceneIds(sceneIds);
    Map<UUID, String> promptsByBeat = visualBeatPromptProvider.promptsFor(projectId, domainVisualBeats);

    List<ChapterStoryResponse.StorySceneItem> sceneItems = new ArrayList<>();

    for (SceneRow scene : scenes) {
      List<StoryBeatRow> sceneBeats = beatsByScene.getOrDefault(scene.getId(), List.of());
      List<VisualBeatRow> sceneUnassignedVisuals =
          unassignedVisualsByScene.getOrDefault(scene.getId(), List.of());

      List<ChapterStoryResponse.StoryBeatItem> beatItems = new ArrayList<>();
      int sceneApprovedCount = 0;
      int sceneTotalVisualCount = 0;

      for (StoryBeatRow beat : sceneBeats) {
        List<AudioCueRow> cues = cuesByBeat.getOrDefault(beat.getId(), List.of());
        List<VisualBeatRow> visuals = visualsByBeat.getOrDefault(beat.getId(), List.of());

        List<ChapterStoryResponse.AudioCueItem> cueItems =
            cues.stream()
                .map(
                    c ->
                        new ChapterStoryResponse.AudioCueItem(
                            c.getId(),
                            c.getStoryBeatId(),
                            c.getOrderIndex(),
                            c.getCueType(),
                            c.getSpeakerProjectCharacterId(),
                            c.getSourceStart(),
                            c.getSourceEnd(),
                            c.getAdaptationAction(),
                            c.getAdaptedText(),
                            c.getDeliveryHint(),
                            c.getNarrationTextStart(),
                            c.getNarrationTextEnd(),
                            c.getAudioStartMs(),
                            c.getAudioEndMs(),
                            c.getStatus(),
                            c.getRowVersion()))
                .toList();

        List<ChapterStoryResponse.VisualBeatItem> visualItems =
            visuals.stream()
                .map(
                    v ->
                        new ChapterStoryResponse.VisualBeatItem(
                            v.getId(),
                            v.getSceneId(),
                            v.getStoryBeatId(),
                            v.getOrderIndex(),
                            v.getTitle(),
                            v.getVisualIntent(),
                            v.getVisualSummary(),
                            v.getVisualDescription(),
                            v.getVisualDirectionJson(),
                            v.getReviewStatus(),
                            v.getMotionMode(),
                            v.getRelativeWeight() != null ? v.getRelativeWeight().doubleValue() : 1.0,
                            v.getVisualFocus() != null ? v.getVisualFocus() : "SPEAKER",
                            v.getAspectRatioOverride(),
                            v.getTextStart(),
                            v.getTextEnd(),
                            v.getSourceAnchorJson(),
                            v.getPreviewMediaAssetId(),
                            promptsByBeat.get(v.getId()),
                            v.getRowVersion()))
                .toList();

        for (VisualBeatRow v : visuals) {
          sceneTotalVisualCount++;
          if ("APPROVED".equals(v.getReviewStatus())) {
            sceneApprovedCount++;
          }
        }

        // Calculate timing from audio cues
        Long beatStartMs = null;
        Long beatEndMs = null;
        for (AudioCueRow cue : cues) {
          if (cue.getAudioStartMs() != null) {
            beatStartMs = beatStartMs == null ? cue.getAudioStartMs() : Math.min(beatStartMs, cue.getAudioStartMs());
          }
          if (cue.getAudioEndMs() != null) {
            beatEndMs = beatEndMs == null ? cue.getAudioEndMs() : Math.max(beatEndMs, cue.getAudioEndMs());
          }
        }
        Long durationMs = (beatStartMs != null && beatEndMs != null) ? (beatEndMs - beatStartMs) : null;

        beatItems.add(
            new ChapterStoryResponse.StoryBeatItem(
                beat.getId(),
                beat.getSceneId(),
                beat.getOrderIndex(),
                beat.getPurpose() != null ? beat.getPurpose() : "Beat " + (beat.getOrderIndex() + 1),
                beat.getPurpose(),
                beat.getSummary(),
                beat.getImportance(),
                beat.getSourceStart(),
                beat.getSourceEnd(),
                beat.getSourceAnchorJson(),
                beat.getStoryFunctionsJson(),
                beat.getContinuityStateJson(),
                beat.getReviewStatus() != null ? beat.getReviewStatus() : "NEEDS_REVIEW",
                cueItems,
                visualItems,
                new ChapterStoryResponse.BeatTiming(beatStartMs, beatEndMs, durationMs),
                beat.getRowVersion()));
      }

      // If there are unassigned visual beats from legacy data, synthesize a default beat container
      if (!sceneUnassignedVisuals.isEmpty() && beatItems.isEmpty()) {
        List<ChapterStoryResponse.VisualBeatItem> visualItems =
            sceneUnassignedVisuals.stream()
                .map(
                    v ->
                        new ChapterStoryResponse.VisualBeatItem(
                            v.getId(),
                            v.getSceneId(),
                            null,
                            v.getOrderIndex(),
                            v.getTitle(),
                            v.getVisualIntent(),
                            v.getVisualSummary(),
                            v.getVisualDescription(),
                            v.getVisualDirectionJson(),
                            v.getReviewStatus(),
                            v.getMotionMode(),
                            v.getRelativeWeight() != null ? v.getRelativeWeight().doubleValue() : 1.0,
                            v.getVisualFocus() != null ? v.getVisualFocus() : "SPEAKER",
                            v.getAspectRatioOverride(),
                            v.getTextStart(),
                            v.getTextEnd(),
                            v.getSourceAnchorJson(),
                            v.getPreviewMediaAssetId(),
                            promptsByBeat.get(v.getId()),
                            v.getRowVersion()))
                .toList();

        for (VisualBeatRow v : sceneUnassignedVisuals) {
          sceneTotalVisualCount++;
          if ("APPROVED".equals(v.getReviewStatus())) {
            sceneApprovedCount++;
          }
        }

        beatItems.add(
            new ChapterStoryResponse.StoryBeatItem(
                UUID.nameUUIDFromBytes(("synth-beat-" + scene.getId()).getBytes()),
                scene.getId(),
                0,
                scene.getTitle(),
                "PLOT",
                "",
                "NORMAL",
                null,
                null,
                null,
                "[]",
                "{}",
                "NEEDS_REVIEW",
                List.of(),
                visualItems,
                new ChapterStoryResponse.BeatTiming(null, null, null),
                0L));
      }

      sceneItems.add(
          new ChapterStoryResponse.StorySceneItem(
              scene.getId(),
              scene.getChapterId(),
              scene.getOrderIndex(),
              scene.getTitle(),
              scene.getStatus(),
              null,
              null,
              null,
              null,
              scene.getLocationText(),
              scene.getProjectLocationId(),
              beatItems,
              sceneApprovedCount,
              sceneTotalVisualCount));
    }

    return new ChapterStoryResponse(
        chapter.getId(),
        chapter.getTitle(),
        chapter.getOrderIndex(),
        null,
        sceneItems);
  }
}
