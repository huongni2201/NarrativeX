package com.narrativex.backend.feature.auth.infrastructure.desktop;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface DesktopAuthHandoffMapper extends NarrativeXMyBatisMapper {
  int insert(DesktopAuthHandoffRow row);

  DesktopAuthHandoffRow consume(@Param("codeHash") String codeHash);

  int deleteExpired();
}
