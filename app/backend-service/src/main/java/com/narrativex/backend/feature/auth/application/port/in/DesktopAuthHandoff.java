package com.narrativex.backend.feature.auth.application.port.in;

/** Application-facing boundary for consuming one-time desktop OAuth handoffs. */
public interface DesktopAuthHandoff {
  AuthenticatedUser consumeUser(String code, String codeVerifier);

  record AuthenticatedUser(String id, String displayName, String email, String avatarUrl) {}
}
