package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface CharacterVersionReferenceMapper extends NarrativeXMyBatisMapper {
  List<CharacterVersionReferenceRow> findByVersionId(
      @Param("characterVersionId") UUID characterVersionId);

  int deleteByVersionId(@Param("characterVersionId") UUID characterVersionId);

  int insert(CharacterVersionReferenceRow row);
}
