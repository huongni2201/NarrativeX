package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.assets.application.port.out.MediaValidationJobRepository.ValidationRequest;
import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface MediaValidationJobMapper extends NarrativeXMyBatisMapper {
  int insertJob(@Param("request") ValidationRequest request, @Param("jobId") UUID jobId);

  int insertOutbox(@Param("request") ValidationRequest request);
}
