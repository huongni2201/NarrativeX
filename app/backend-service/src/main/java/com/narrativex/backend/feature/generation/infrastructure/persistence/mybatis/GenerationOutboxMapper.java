package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface GenerationOutboxMapper extends NarrativeXMyBatisMapper {
  int enqueue(GenerationOutboxRow row);

  List<OutboxDispatchRow> reserveBatch(@Param("reservationMillis") long reservationMillis);

  int markPublished(@Param("id") long id);

  int scheduleRetry(@Param("id") long id, @Param("retryMillis") long retryMillis);
}
