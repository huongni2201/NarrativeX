package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface AttentionEventMapper extends NarrativeXMyBatisMapper {
  List<AttentionEventRow> findByRetentionMapId(@Param("retentionMapId") UUID retentionMapId);

  AttentionEventRow findById(@Param("id") UUID id);

  UUID insert(AttentionEventRow row);

  int insertBatch(@Param("events") List<AttentionEventRow> events);

  int deleteByRetentionMapId(@Param("retentionMapId") UUID retentionMapId);
}
