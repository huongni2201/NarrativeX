package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface StoryboardMapper extends NarrativeXMyBatisMapper {
  List<SceneRow> findCurrentScenes(@Param("chapterId") UUID chapterId);

  List<VisualBeatRow> findVisualBeats(@Param("sceneIds") List<UUID> sceneIds);

  SceneRow findScene(@Param("id") UUID id);

  SceneRow findSceneForUpdate(@Param("id") UUID id, @Param("chapterId") UUID chapterId);

  VisualBeatRow findVisualBeat(@Param("id") UUID id);

  int maxVisualBeatOrder(@Param("sceneId") UUID sceneId);

  UUID insertVisualBeat(VisualBeatRow row);

  UUID insertScene(SceneRow row);

  int updateVisualBeat(VisualBeatRow row);

  // --- StoryBeat ---
  List<StoryBeatRow> findStoryBeats(@Param("sceneIds") List<UUID> sceneIds);

  StoryBeatRow findStoryBeat(@Param("id") UUID id);

  StoryBeatRow findCurrentStoryBeatByChapter(
      @Param("id") UUID id, @Param("chapterId") UUID chapterId);

  UUID insertStoryBeat(StoryBeatRow row);

  int updateStoryBeat(StoryBeatRow row);

  int updateStoryBeatReviewStatus(
      @Param("chapterId") UUID chapterId,
      @Param("id") UUID id,
      @Param("reviewStatus") String reviewStatus,
      @Param("expectedRowVersion") long expectedRowVersion);

  // --- AudioCue ---
  List<AudioCueRow> findAudioCues(@Param("storyBeatIds") List<UUID> storyBeatIds);

  AudioCueRow findAudioCue(@Param("id") UUID id);

  UUID insertAudioCue(AudioCueRow row);

  int updateAudioCue(AudioCueRow row);

  // --- NarrationScript ---
  NarrationScriptRow findLatestNarrationScript(@Param("chapterId") UUID chapterId);

  NarrationScriptRow findNarrationScriptByRevision(
      @Param("chapterId") UUID chapterId, @Param("storyboardRevisionId") UUID storyboardRevisionId);

  NarrationScriptRow findNarrationScript(@Param("id") UUID id);

  UUID insertNarrationScript(NarrationScriptRow row);

  int updateNarrationScript(NarrationScriptRow row);
}
