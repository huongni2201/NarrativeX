package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface SelectedTakeMapper extends NarrativeXMyBatisMapper {
  SelectedTakeRow findByShotId(@Param("shotId") UUID shotId);

  int insert(SelectedTakeRow row);

  int update(SelectedTakeRow row);

  int deleteByShotId(@Param("shotId") UUID shotId);
}
