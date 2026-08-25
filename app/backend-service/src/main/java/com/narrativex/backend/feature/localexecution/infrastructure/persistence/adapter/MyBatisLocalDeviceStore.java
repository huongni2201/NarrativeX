package com.narrativex.backend.feature.localexecution.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.localexecution.application.port.out.LocalDeviceStore;
import com.narrativex.backend.feature.localexecution.application.query.LocalDeviceView;
import com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis.DeviceRow;
import com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis.LocalDeviceMapper;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisLocalDeviceStore implements LocalDeviceStore {
  private final LocalDeviceMapper mapper;

  @Override
  public void createPairingCode(String userId, String codeHash, Instant expiresAt) {
    mapper.insertPairingCode(userId, codeHash, expiresAt);
  }

  @Override
  public Optional<PairingCodeRecord> consumePairingCode(String codeHash, Instant now) {
    var row = mapper.consumePairingCode(codeHash, now);
    return Optional.ofNullable(row)
        .map(
            value ->
                new PairingCodeRecord(
                    value.id(), value.userId(), value.expiresAt(), value.consumedAt()));
  }

  @Override
  public void createDevice(
      UUID deviceId,
      String userId,
      String name,
      String platform,
      String agentVersion,
      String tokenHash,
      Instant now,
      List<String> capabilities) {
    mapper.insertDevice(deviceId, userId, name, platform, agentVersion, tokenHash, now);
    replaceCapabilities(deviceId, capabilities);
  }

  @Override
  public Optional<DeviceRecord> findByTokenHash(String tokenHash) {
    DeviceRow row = mapper.findByTokenHash(tokenHash);
    return Optional.ofNullable(row)
        .map(value -> new DeviceRecord(value.id(), value.userId(), value.revokedAt()));
  }

  @Override
  public void heartbeat(
      UUID deviceId, String agentVersion, Instant now, List<String> capabilities) {
    mapper.updateHeartbeat(deviceId, agentVersion, now);
    replaceCapabilities(deviceId, capabilities);
  }

  @Override
  public List<String> listCapabilities(UUID deviceId) {
    return mapper.listCapabilities(deviceId);
  }

  @Override
  public List<LocalDeviceView> listByUser(String userId, Instant onlineThreshold) {
    return mapper.listByUser(userId, onlineThreshold).stream()
        .map(
            row ->
                new LocalDeviceView(
                    row.id(),
                    row.name(),
                    row.platform(),
                    row.agentVersion(),
                    mapper.listCapabilities(row.id()),
                    row.lastSeenAt(),
                    row.online()))
        .toList();
  }

  private void replaceCapabilities(UUID deviceId, List<String> capabilities) {
    mapper.deleteCapabilities(deviceId);
    for (String capability : capabilities) mapper.insertCapability(deviceId, capability);
  }
}
