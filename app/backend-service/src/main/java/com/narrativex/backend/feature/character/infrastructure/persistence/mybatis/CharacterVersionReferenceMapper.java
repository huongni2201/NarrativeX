package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface CharacterVersionReferenceMapper extends NarrativeXMyBatisMapper {
  List<CharacterVersionReferenceRow> findByVersionId(
      @Param("characterVersionId") Long characterVersionId);

  int deleteByVersionId(@Param("characterVersionId") Long characterVersionId);

  int insert(CharacterVersionReferenceRow row);
}
