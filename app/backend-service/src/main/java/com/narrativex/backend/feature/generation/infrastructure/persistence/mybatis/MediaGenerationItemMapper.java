package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface MediaGenerationItemMapper extends NarrativeXMyBatisMapper {
  UUID insert(MediaGenerationItemRow row);

  MediaGenerationItemRow findById(@Param("id") UUID id);

  MediaGenerationItemRow findOwned(@Param("userId") String userId, @Param("id") UUID id);

  List<MediaGenerationItemRow> findByJobOwned(
      @Param("userId") String userId, @Param("jobId") UUID jobId);

  int review(
      @Param("userId") String userId,
      @Param("id") UUID id,
      @Param("rowVersion") long rowVersion,
      @Param("decision") String decision,
      @Param("reviewerId") String reviewerId);
}
