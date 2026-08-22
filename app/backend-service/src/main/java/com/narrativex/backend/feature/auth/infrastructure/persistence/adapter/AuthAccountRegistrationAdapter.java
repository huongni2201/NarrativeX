package com.narrativex.backend.feature.auth.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.auth.application.port.out.AuthAccountRegistration;
import com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis.AuthUserMapper;
import com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis.AuthUserRow;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthAccountRegistrationAdapter implements AuthAccountRegistration {
  private final AuthUserMapper mapper;

  @Override
  public boolean existsByEmail(String email) {
    return mapper.existsByEmail(email);
  }

  @Override
  public void createPasswordAccount(
      String id, String email, String displayName, String passwordHash) {
    try {
      Instant now = Instant.now();
      mapper.insert(
          AuthUserRow.builder()
              .id(id)
              .email(email)
              .displayName(displayName)
              .passwordHash(passwordHash)
              .enabled(true)
              .createdAt(now)
              .updatedAt(now)
              .build());
    } catch (DataIntegrityViolationException exception) {
      throw new ResourceConflictException("An account already exists for this email.");
    }
  }
}
