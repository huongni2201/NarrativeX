package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface StoryboardMapper extends NarrativeXMyBatisMapper {
  List<SceneRow> findCurrentScenes(@Param("chapterId") Long chapterId);
  List<VisualBeatRow> findVisualBeats(@Param("sceneIds") List<Long> sceneIds);
  SceneRow findScene(@Param("id") Long id);
  SceneRow findSceneForUpdate(@Param("id") Long id, @Param("chapterId") Long chapterId);
  VisualBeatRow findVisualBeat(@Param("id") Long id);
  int maxVisualBeatOrder(@Param("sceneId") Long sceneId);
  Long insertVisualBeat(VisualBeatRow row);
  int updateVisualBeat(VisualBeatRow row);
}
