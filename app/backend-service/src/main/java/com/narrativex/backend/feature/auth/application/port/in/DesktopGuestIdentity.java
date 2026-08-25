package com.narrativex.backend.feature.auth.application.port.in;

/** Application boundary for stable desktop guest installations and ownership handoff. */
public interface DesktopGuestIdentity {
  String establish(String deviceId, String secret);

  void transferOwnership(String sourceGuestUserId, String targetUserId);
}
