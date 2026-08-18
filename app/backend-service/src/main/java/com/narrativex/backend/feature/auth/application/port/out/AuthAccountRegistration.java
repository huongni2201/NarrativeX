package com.narrativex.backend.feature.auth.application.port.out;

public interface AuthAccountRegistration {
  boolean existsByEmail(String email);

  void createPasswordAccount(String id, String email, String displayName, String passwordHash);
}
