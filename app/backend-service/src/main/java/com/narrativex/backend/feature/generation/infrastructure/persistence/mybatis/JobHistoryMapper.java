package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface JobHistoryMapper extends NarrativeXMyBatisMapper {
  List<JobHistoryRow> list(
      @Param("userId") String userId,
      @Param("cursorUpdatedAt") Instant cursorUpdatedAt,
      @Param("cursorId") Long cursorId,
      @Param("limit") int limit);
}
