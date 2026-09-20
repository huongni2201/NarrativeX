package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface TakeMapper extends NarrativeXMyBatisMapper {
  List<TakeRow> findByShotId(@Param("shotId") UUID shotId);

  TakeRow findById(@Param("id") UUID id);

  TakeRow findByShotIdAndAttempt(
      @Param("shotId") UUID shotId, @Param("attemptNumber") int attemptNumber);

  UUID insert(TakeRow row);

  int update(TakeRow row);

  int updateStatus(@Param("id") UUID id, @Param("status") String status);

  int updateValidation(TakeRow row);

  int deleteById(@Param("id") UUID id);
}
