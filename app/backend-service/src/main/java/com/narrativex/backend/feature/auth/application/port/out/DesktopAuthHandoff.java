package com.narrativex.backend.feature.auth.application.port.out;

/** Application-facing boundary for consuming one-time desktop OAuth handoffs. */
public interface DesktopAuthHandoff {
  AuthenticatedUser consumeUser(String code);

  record AuthenticatedUser(String id, String displayName, String email, String avatarUrl) {}
}
