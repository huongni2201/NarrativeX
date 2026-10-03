package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Component
@RequiredArgsConstructor
public class MyBatisStoryboardProductionAccessAdapter implements StoryboardProductionAccess {
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final ShotMapper shotMapper;
  private final ChapterMapper chapterMapper;
  private final StoryboardMapper storyboardMapper;
  private final ShotSequenceMapper shotSequenceMapper;

  @Override
  public String findAdmissionContextLocked(UUID projectId, UUID shotId) {
    return shotMapper.findAdmissionContextLocked(projectId, shotId);
  }

  @Override
  public UUID findChapterIdByShotId(UUID projectId, UUID shotId) {
    return shotMapper.findChapterIdByShotId(projectId, shotId);
  }

  @Override
  public Optional<ChapterInfo> findChapter(UUID chapterId) {
    ChapterRow row = chapterMapper.findById(chapterId);
    if (row == null) return Optional.empty();
    return Optional.of(
        new ChapterInfo(row.getId(), row.getStoryVersionId(), row.getTitle(), row.getOrderIndex()));
  }

  @Override
  public List<SceneInfo> findScenes(UUID chapterId) {
    return storyboardMapper.findCurrentScenes(chapterId).stream()
        .map(s -> new SceneInfo(s.getId(), s.getOrderIndex(), s.getTitle()))
        .toList();
  }

  @Override
  public List<VisualBeatInfo> findVisualBeats(List<UUID> sceneIds) {
    if (sceneIds == null || sceneIds.isEmpty()) return List.of();
    return storyboardMapper.findVisualBeats(sceneIds).stream()
        .map(
            vb ->
                new VisualBeatInfo(
                    vb.getId(),
                    vb.getSceneId(),
                    vb.getStoryBeatId(),
                    vb.getOrderIndex(),
                    vb.getTitle(),
                    vb.getVisualIntent(),
                    vb.getReviewStatus(),
                    vb.getPreviewMediaAssetId(),
                    vb.getVisualDescription() != null
                        ? vb.getVisualDescription()
                        : vb.getVisualIntent()))
        .toList();
  }

  @Override
  public List<AudioCueInfo> findAudioCues(List<UUID> storyBeatIds) {
    if (storyBeatIds == null || storyBeatIds.isEmpty()) return List.of();
    return storyboardMapper.findAudioCues(storyBeatIds).stream()
        .map(
            c ->
                new AudioCueInfo(
                    c.getId(),
                    c.getStoryBeatId(),
                    c.getOrderIndex(),
                    c.getCueType(),
                    c.getSpeakerProjectCharacterId()))
        .toList();
  }

  @Override
  public List<ShotSequenceInfo> findSequences(List<UUID> visualBeatIds) {
    if (visualBeatIds == null || visualBeatIds.isEmpty()) return List.of();
    return shotSequenceMapper.findByVisualBeatIds(visualBeatIds).stream()
        .map(sq -> new ShotSequenceInfo(sq.getId(), sq.getVisualBeatId(), sq.getOrderIndex()))
        .toList();
  }

  @Override
  public List<ShotInfo> findShotsByChapter(UUID projectId, UUID chapterId) {
    return shotMapper.findCurrentShotsByChapter(projectId, chapterId).stream()
        .map(this::toShotInfo)
        .toList();
  }

  @Override
  public Optional<ShotInfo> findShot(UUID projectId, UUID shotId) {
    ShotRow row = shotMapper.findShotByIdAndProject(projectId, shotId);
    return Optional.ofNullable(toShotInfo(row));
  }

  @Override
  public Optional<VisualBeatInfo> findVisualBeat(UUID visualBeatId) {
    VisualBeatRow vb = storyboardMapper.findVisualBeat(visualBeatId);
    if (vb == null) return Optional.empty();
    return Optional.of(
        new VisualBeatInfo(
            vb.getId(),
            vb.getSceneId(),
            vb.getStoryBeatId(),
            vb.getOrderIndex(),
            vb.getTitle(),
            vb.getVisualIntent(),
            vb.getReviewStatus(),
            vb.getPreviewMediaAssetId(),
            vb.getVisualDescription() != null ? vb.getVisualDescription() : vb.getVisualIntent()));
  }

  @Override
  public Optional<ShotSequenceInfo> findSequenceById(UUID sequenceId) {
    ShotSequenceRow sq = shotSequenceMapper.findById(sequenceId);
    if (sq == null) return Optional.empty();
    return Optional.of(new ShotSequenceInfo(sq.getId(), sq.getVisualBeatId(), sq.getOrderIndex()));
  }

  @Override
  public void updateShotStatus(UUID shotId, String status) {
    shotMapper.updateStatus(shotId, status);
  }

  @Override
  public void updateShotStrategy(UUID shotId, GenerationStrategy strategy) {
    shotMapper.updateStrategy(shotId, strategy != null ? strategy.name() : null);
  }

  private ShotInfo toShotInfo(ShotRow shot) {
    if (shot == null) return null;
    GenerationStrategy strategy = GenerationStrategy.TEXT_TO_VIDEO;
    if (shot.getGenerationStrategy() != null) {
      try {
        strategy = GenerationStrategy.valueOf(shot.getGenerationStrategy());
      } catch (Exception ignored) {
      }
    }
    List<String> subjects = parseSubjectsList(shot.getSubjectsJson());
    return new ShotInfo(
        shot.getId(),
        shot.getSequenceId(),
        shot.getOrderIndex(),
        shot.getNarrativePurpose(),
        shot.getRetentionRole(),
        subjects,
        shot.getLocationRef(),
        shot.getStartStateJson(),
        shot.getActionJson(),
        shot.getEndStateJson(),
        shot.getCompositionJson(),
        shot.getCameraJson(),
        shot.getSubjectMotionJson(),
        shot.getCameraMotionJson(),
        shot.getEnvironmentMotionJson(),
        shot.getTargetDurationMs(),
        strategy,
        shot.getQualityProfile(),
        shot.getStatus());
  }

  private List<String> parseSubjectsList(String subjectsJson) {
    if (subjectsJson == null || subjectsJson.isBlank() || "[]".equals(subjectsJson.trim())) {
      return List.of();
    }
    try {
      List<Map<String, Object>> list =
          JSON.readValue(subjectsJson, new TypeReference<List<Map<String, Object>>>() {});
      List<String> result = new ArrayList<>();
      for (Map<String, Object> item : list) {
        if (item.containsKey("name")) {
          result.add(String.valueOf(item.get("name")));
        } else if (item.containsKey("characterName")) {
          result.add(String.valueOf(item.get("characterName")));
        }
      }
      return result;
    } catch (Exception ignored) {
      return List.of();
    }
  }
}
