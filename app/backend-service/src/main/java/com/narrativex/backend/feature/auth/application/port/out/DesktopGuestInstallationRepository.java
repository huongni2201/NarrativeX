package com.narrativex.backend.feature.auth.application.port.out;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface DesktopGuestInstallationRepository {
  void lockDevice(UUID deviceId);

  Optional<Installation> findByDeviceId(UUID deviceId);

  boolean create(UUID deviceId, String guestUserId, String secretHash, Instant now);

  void touch(UUID deviceId, Instant now);

  record Installation(UUID deviceId, String guestUserId, String secretHash) {}
}
