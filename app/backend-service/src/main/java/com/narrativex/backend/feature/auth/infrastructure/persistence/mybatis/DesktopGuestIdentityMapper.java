package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface DesktopGuestIdentityMapper extends NarrativeXMyBatisMapper {
  int lockDevice(@Param("deviceId") UUID deviceId);

  DesktopGuestInstallationRow findByDeviceId(@Param("deviceId") UUID deviceId);

  int insertGuestUser(
      @Param("id") String id, @Param("email") String email, @Param("now") Instant now);

  int insertInstallation(
      @Param("deviceId") UUID deviceId,
      @Param("guestUserId") String guestUserId,
      @Param("secretHash") String secretHash,
      @Param("now") Instant now);

  int touch(@Param("deviceId") UUID deviceId, @Param("now") Instant now);

  int deleteDuplicateChecksums(
      @Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferProjects(
      @Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferCharacters(
      @Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferChapterIdempotency(
      @Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferMediaAssets(
      @Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);

  int transferMediaChecksums(
      @Param("sourceUserId") String sourceUserId, @Param("targetUserId") String targetUserId);
}
