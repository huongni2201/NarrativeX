package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface SelectedTakeMapper extends NarrativeXMyBatisMapper {
  SelectedTakeRow findByShotId(@Param("shotId") UUID shotId);

  java.util.List<SelectedTakeRow> findByShotIds(@Param("shotIds") java.util.List<UUID> shotIds);

  int updateSelection(
      @Param("shotId") UUID shotId,
      @Param("takeId") UUID takeId,
      @Param("sourceInMs") long sourceInMs,
      @Param("sourceOutMs") long sourceOutMs,
      @Param("expectedRowVersion") long expectedRowVersion,
      @Param("reviewFingerprint") String reviewFingerprint,
      @Param("reviewChecklistJson") String reviewChecklistJson);

  int insertSelection(
      @Param("shotId") UUID shotId,
      @Param("takeId") UUID takeId,
      @Param("sourceInMs") long sourceInMs,
      @Param("sourceOutMs") long sourceOutMs,
      @Param("reviewFingerprint") String reviewFingerprint,
      @Param("reviewChecklistJson") String reviewChecklistJson);

  int deleteByShotId(@Param("shotId") UUID shotId);
}
