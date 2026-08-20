package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface NarrationMapper extends NarrativeXMyBatisMapper {
  int insertRequest(NarrationRequestRow row);

  NarrationRequestRow findRequestByFingerprint(@Param("requestFingerprint") String requestFingerprint);

  int insertOperation(NarrationOperationRow row);
}
