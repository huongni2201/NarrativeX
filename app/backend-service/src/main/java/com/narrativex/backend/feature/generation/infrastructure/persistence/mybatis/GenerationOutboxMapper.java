package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;

public interface GenerationOutboxMapper extends NarrativeXMyBatisMapper {
  int enqueue(GenerationOutboxRow row);
}
