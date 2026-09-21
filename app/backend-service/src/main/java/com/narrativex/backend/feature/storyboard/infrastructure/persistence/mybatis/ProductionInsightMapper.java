package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ProductionInsightMapper extends NarrativeXMyBatisMapper {
  int insert(ProductionInsightRow row);

  ProductionInsightRow findById(@Param("id") UUID id);

  List<ProductionInsightRow> findByProjectId(@Param("projectId") UUID projectId);

  List<ProductionInsightRow> findByChapterId(@Param("chapterId") UUID chapterId);

  int updateStatus(
      @Param("id") UUID id,
      @Param("status") String status,
      @Param("expectedRowVersion") long expectedRowVersion);
}
