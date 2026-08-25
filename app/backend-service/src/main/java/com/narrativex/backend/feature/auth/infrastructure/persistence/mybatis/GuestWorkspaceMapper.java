package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface GuestWorkspaceMapper extends NarrativeXMyBatisMapper {
  int transferProjects(
      @Param("guestUserId") String guestUserId,
      @Param("authenticatedUserId") String authenticatedUserId);

  int transferCharacters(
      @Param("guestUserId") String guestUserId,
      @Param("authenticatedUserId") String authenticatedUserId);

  int transferChapterCreationIdempotency(
      @Param("guestUserId") String guestUserId,
      @Param("authenticatedUserId") String authenticatedUserId);

  int deleteGuestMediaChecksums(@Param("guestUserId") String guestUserId);

  int transferMediaAssets(
      @Param("guestUserId") String guestUserId,
      @Param("authenticatedUserId") String authenticatedUserId);

  int rebuildMediaChecksums(@Param("authenticatedUserId") String authenticatedUserId);
}
