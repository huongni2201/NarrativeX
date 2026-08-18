package com.narrativex.backend.feature.auth.application.service;

import com.narrativex.backend.feature.auth.application.port.out.AuthAccountRegistration;
import com.narrativex.backend.feature.auth.application.port.out.PasswordHashing;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RegisterAuthAccountService {
  private final AuthAccountRegistration accounts;
  private final PasswordHashing passwordHashing;

  @Transactional
  public String register(String displayName, String email, String rawPassword) {
    String normalizedEmail = normalizeEmail(email);
    if (accounts.existsByEmail(normalizedEmail)) {
      throw new ResourceConflictException("An account already exists for this email.");
    }

    String userId = UUID.randomUUID().toString();
    accounts.createPasswordAccount(
        userId, normalizedEmail, displayName.trim(), passwordHashing.encode(rawPassword));
    return userId;
  }

  public static String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
