package com.narrativex.backend.feature.auth.application.port.out;

import java.time.Instant;
import java.util.Optional;

public interface DesktopGuestInstallationRepository {
  Optional<Installation> findByDeviceId(String deviceId);

  boolean create(String deviceId, String guestUserId, String secretHash, Instant now);

  void touch(String deviceId, Instant now);

  record Installation(String deviceId, String guestUserId, String secretHash) {}
}
