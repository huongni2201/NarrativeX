package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import org.apache.ibatis.annotations.Param;

public interface DesktopGuestIdentityMapper extends NarrativeXMyBatisMapper {
  int lockDevice(@Param("deviceId") String deviceId);

  DesktopGuestInstallationRow findByDeviceId(@Param("deviceId") String deviceId);

  int insertGuestUser(
      @Param("id") String id, @Param("email") String email, @Param("now") Instant now);

  int insertInstallation(
      @Param("deviceId") String deviceId,
      @Param("guestUserId") String guestUserId,
      @Param("secretHash") String secretHash,
      @Param("now") Instant now);

  int touch(@Param("deviceId") String deviceId, @Param("now") Instant now);

  int deleteDuplicateChecksums(
      @Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferProjects(@Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferCharacters(@Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferChapterIdempotency(@Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferMediaAssets(@Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferMediaChecksums(@Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferMediaUploadSessions(@Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);
}
