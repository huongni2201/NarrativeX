package com.narrativex.backend.feature.localexecution.application.port.in;

import java.util.UUID;

public interface LocalDeviceAccess {
  void requireEligibleDevice(UUID deviceId, String capability);

  AuthenticatedDevice authenticate(String deviceToken, String requiredCapability);

  record AuthenticatedDevice(UUID id) {}
}
