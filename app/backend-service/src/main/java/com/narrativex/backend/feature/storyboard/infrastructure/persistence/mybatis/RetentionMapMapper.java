package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface RetentionMapMapper extends NarrativeXMyBatisMapper {
  RetentionMapRow findByChapterId(@Param("chapterId") UUID chapterId);

  RetentionMapRow findById(@Param("id") UUID id);

  UUID insert(RetentionMapRow row);

  int update(RetentionMapRow row);

  int deleteByChapterId(@Param("chapterId") UUID chapterId);
}
