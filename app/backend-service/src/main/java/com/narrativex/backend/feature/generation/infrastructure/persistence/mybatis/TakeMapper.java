package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface TakeMapper extends NarrativeXMyBatisMapper {
  List<TakeRow> findByShotId(@Param("shotId") UUID shotId);

  List<TakeRow> findByShotIds(@Param("shotIds") List<UUID> shotIds);

  TakeRow findById(@Param("id") UUID id);

  TakeRow findByShotIdAndAttempt(
      @Param("shotId") UUID shotId, @Param("attemptNumber") int attemptNumber);

  TakeRow findByGenerationJobId(@Param("generationJobId") UUID generationJobId);

  List<com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot.Reference>
      findReferences(@Param("projectId") UUID projectId, @Param("shotId") UUID shotId);

  UUID insert(TakeRow row);

  int update(TakeRow row);

  int updateStatus(@Param("id") UUID id, @Param("status") String status);

  int updateValidation(TakeRow row);

  List<TakeRow> findByJobId(@Param("generationJobId") String generationJobId);

  TakeRow findByTaskId(@Param("computeTaskId") UUID computeTaskId);

  int deleteById(@Param("id") UUID id);
}
