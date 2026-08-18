package com.narrativex.backend.feature.auth.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.auth.application.port.out.AuthAccountRegistration;
import com.narrativex.backend.feature.auth.infrastructure.persistence.entity.AuthUserJpaEntity;
import com.narrativex.backend.feature.auth.infrastructure.persistence.repository.AuthUserJpaRepository;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthAccountRegistrationAdapter implements AuthAccountRegistration {
  private final AuthUserJpaRepository repository;

  @Override
  public boolean existsByEmail(String email) {
    return repository.existsByEmailIgnoreCase(email);
  }

  @Override
  public void createPasswordAccount(
      String id, String email, String displayName, String passwordHash) {
    try {
      Instant now = Instant.now();
      repository.saveAndFlush(
          AuthUserJpaEntity.builder()
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
