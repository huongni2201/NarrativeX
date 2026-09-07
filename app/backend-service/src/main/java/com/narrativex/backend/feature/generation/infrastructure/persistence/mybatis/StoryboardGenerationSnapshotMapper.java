package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface StoryboardGenerationSnapshotMapper extends NarrativeXMyBatisMapper {
  StoryboardGenerationScopeRow findCurrentScope(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  StoryboardGenerationBatchRow findBatchByIdempotencyKey(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("idempotencyKey") String idempotencyKey);

  StoryboardGenerationBatchRow findBatchById(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("batchId") UUID batchId);

  List<StoryboardGenerationBeatSnapshotRow> findBeatSnapshots(@Param("batchId") UUID batchId);

  void insertBatch(StoryboardGenerationBatchRow row);

  void insertBeatSnapshot(StoryboardGenerationBeatSnapshotRow row);
}
