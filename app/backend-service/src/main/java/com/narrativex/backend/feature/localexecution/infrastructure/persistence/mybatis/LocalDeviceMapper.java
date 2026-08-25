package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface LocalDeviceMapper extends NarrativeXMyBatisMapper {
  int insertPairingCode(
      @Param("userId") String userId,
      @Param("codeHash") String codeHash,
      @Param("expiresAt") Instant expiresAt);

  PairingCodeRow consumePairingCode(@Param("codeHash") String codeHash, @Param("now") Instant now);

  int insertDevice(
      @Param("id") UUID id,
      @Param("userId") String userId,
      @Param("name") String name,
      @Param("platform") String platform,
      @Param("agentVersion") String agentVersion,
      @Param("tokenHash") String tokenHash,
      @Param("now") Instant now);

  DeviceRow findByTokenHash(@Param("tokenHash") String tokenHash);

  int updateHeartbeat(
      @Param("id") UUID id, @Param("agentVersion") String agentVersion, @Param("now") Instant now);

  int deleteCapabilities(@Param("deviceId") UUID deviceId);

  int insertCapability(@Param("deviceId") UUID deviceId, @Param("capability") String capability);

  List<String> listCapabilities(@Param("deviceId") UUID deviceId);

  List<DeviceListRow> listByUser(
      @Param("userId") String userId, @Param("onlineThreshold") Instant onlineThreshold);
}
