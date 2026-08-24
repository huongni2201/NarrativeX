package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface AuthUserMapper extends NarrativeXMyBatisMapper {
  AuthUserRow findByEmail(@Param("email") String email);

  AuthUserRow findByGoogleSubject(@Param("googleSubject") String googleSubject);

  int insert(AuthUserRow row);

  int updateGoogleLink(AuthUserRow row);
}
