package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ShotSequenceMapper extends NarrativeXMyBatisMapper {
  ShotSequenceRow findByVisualBeatId(@Param("visualBeatId") UUID visualBeatId);

  List<ShotSequenceRow> findByVisualBeatIds(@Param("visualBeatIds") List<UUID> visualBeatIds);

  ShotSequenceRow findById(@Param("id") UUID id);

  UUID insert(ShotSequenceRow row);

  int update(ShotSequenceRow row);

  int deleteById(@Param("id") UUID id);
}
