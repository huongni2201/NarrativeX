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

  int updateVisualBeat(VisualBeatRow row);
}
