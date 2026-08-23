package com.narrativex.backend.feature.localexecution.application.port.out;

import com.narrativex.backend.feature.localexecution.application.query.LocalDeviceView;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LocalDeviceStore {
  void createPairingCode(String userId, String codeHash, Instant expiresAt);

  Optional<PairingCodeRecord> consumePairingCode(String codeHash, Instant now);

  void createDevice(
      UUID deviceId,
      String userId,
      String name,
      String platform,
      String agentVersion,
      String tokenHash,
      Instant now,
      List<String> capabilities);

  Optional<DeviceRecord> findByTokenHash(String tokenHash);

  void heartbeat(
      UUID deviceId, String agentVersion, Instant now, List<String> capabilities);

  List<LocalDeviceView> listByUser(String userId, Instant onlineThreshold);

  record PairingCodeRecord(long id, String userId, Instant expiresAt, Instant consumedAt) {}

  record DeviceRecord(UUID id, String userId, Instant revokedAt) {}
}
