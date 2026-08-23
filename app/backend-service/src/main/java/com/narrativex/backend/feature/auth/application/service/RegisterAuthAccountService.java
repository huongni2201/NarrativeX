package com.narrativex.backend.feature.auth.application.service;

import com.narrativex.backend.feature.auth.application.port.out.AuthAccountRegistration;
import com.narrativex.backend.feature.auth.application.port.out.PasswordHashing;
import com.narrativex.backend.feature.common.application.port.out.UserPlanAssignmentProvisioner;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
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
  private final UserPlanAssignmentProvisioner userPlanAssignmentProvisioner;

  @Transactional
  public String register(String displayName, String email, String rawPassword) {
    String normalizedEmail = normalizeEmail(email);
    if (accounts.existsByEmail(normalizedEmail)) {
      throw new ResourceConflictException("An account already exists for this email.");
    }

    String userId = UuidV7.random().toString();
    accounts.createPasswordAccount(
        userId, normalizedEmail, displayName.trim(), passwordHashing.encode(rawPassword));
    userPlanAssignmentProvisioner.ensureDefaultAssignment(userId);
    return userId;
  }

  public static String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
