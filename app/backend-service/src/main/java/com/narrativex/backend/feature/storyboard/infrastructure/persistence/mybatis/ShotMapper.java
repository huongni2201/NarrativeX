package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ShotMapper extends NarrativeXMyBatisMapper {
  List<ShotRow> findBySequenceId(@Param("sequenceId") UUID sequenceId);

  List<ShotRow> findBySequenceIds(@Param("sequenceIds") List<UUID> sequenceIds);

  ShotRow findById(@Param("id") UUID id);

  UUID insert(ShotRow row);

  int insertBatch(@Param("shots") List<ShotRow> shots);

  int update(ShotRow row);

  int updateStatus(@Param("id") UUID id, @Param("status") String status);

  int deleteById(@Param("id") UUID id);

  List<ShotRow> findCurrentShotsByChapter(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  ShotRow findShotByIdAndProject(@Param("projectId") UUID projectId, @Param("shotId") UUID shotId);

  ShotSequenceRow findSequenceByBeatIdAndProject(
      @Param("projectId") UUID projectId, @Param("visualBeatId") UUID visualBeatId);
}
