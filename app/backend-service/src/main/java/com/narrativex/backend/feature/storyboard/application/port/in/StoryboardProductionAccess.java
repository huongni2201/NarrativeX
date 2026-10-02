package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StoryboardProductionAccess {
  UUID findChapterIdByShotId(UUID projectId, UUID shotId);

  Optional<ChapterInfo> findChapter(UUID chapterId);

  List<SceneInfo> findScenes(UUID chapterId);

  List<VisualBeatInfo> findVisualBeats(List<UUID> sceneIds);

  List<AudioCueInfo> findAudioCues(List<UUID> storyBeatIds);

  List<ShotSequenceInfo> findSequences(List<UUID> visualBeatIds);

  List<ShotInfo> findShotsByChapter(UUID projectId, UUID chapterId);

  Optional<ShotInfo> findShot(UUID projectId, UUID shotId);

  Optional<VisualBeatInfo> findVisualBeat(UUID visualBeatId);

  Optional<ShotSequenceInfo> findSequenceById(UUID sequenceId);

  void updateShotStatus(UUID shotId, String status);

  void updateShotStrategy(UUID shotId, GenerationStrategy strategy);

  record ChapterInfo(UUID id, UUID storyVersionId, String title, int orderIndex) {}

  record SceneInfo(UUID id, int orderIndex, String title) {}

  record VisualBeatInfo(
      UUID id,
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String reviewStatus,
      UUID previewMediaAssetId,
      String prompt) {}

  record AudioCueInfo(
      UUID id, UUID storyBeatId, int orderIndex, String cueType, UUID speakerProjectCharacterId) {}

  record ShotSequenceInfo(UUID id, UUID visualBeatId, int orderIndex) {}

  record ShotInfo(
      UUID id,
      UUID sequenceId,
      int orderIndex,
      String narrativePurpose,
      String retentionRole,
      List<String> subjects,
      String locationRef,
      String startStateJson,
      String actionJson,
      String endStateJson,
      String compositionJson,
      String cameraJson,
      String subjectMotionJson,
      String cameraMotionJson,
      String environmentMotionJson,
      long targetDurationMs,
      GenerationStrategy generationStrategy,
      String qualityProfile,
      String status) {}
}
