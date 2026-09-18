package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterAnalysisRunMapper extends NarrativeXMyBatisMapper {
  int insert(ChapterAnalysisRunRow row);

  ChapterAnalysisRunRow findById(@Param("id") UUID id);

  ChapterAnalysisRunRow findLatestByChapterId(@Param("chapterId") UUID chapterId);

  List<ChapterAnalysisRunRow> findByChapterId(@Param("chapterId") UUID chapterId);

  ChapterAnalysisRunRow findByJobId(@Param("generationJobId") UUID generationJobId);
}
