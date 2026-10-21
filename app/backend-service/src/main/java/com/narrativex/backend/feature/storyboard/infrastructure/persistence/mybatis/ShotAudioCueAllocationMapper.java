package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ShotAudioCueAllocationMapper extends NarrativeXMyBatisMapper {
  Long findVersionBySequenceId(@Param("sequenceId") UUID sequenceId);

  List<ShotAudioCueAllocationRow> findBySequenceId(@Param("sequenceId") UUID sequenceId);

  UUID findSequenceIdByAudioCueId(@Param("audioCueId") UUID audioCueId);

  int incrementVersion(
      @Param("sequenceId") UUID sequenceId, @Param("expectedRowVersion") long expectedRowVersion);

  int insertInitialVersion(@Param("sequenceId") UUID sequenceId);

  int deleteBySequenceId(@Param("sequenceId") UUID sequenceId);

  int insertBatch(@Param("allocations") List<ShotAudioCueAllocationRow> allocations);
}
