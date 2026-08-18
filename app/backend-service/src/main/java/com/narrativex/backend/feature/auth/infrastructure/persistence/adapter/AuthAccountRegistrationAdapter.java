package com.narrativex.backend.feature.auth.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.auth.application.port.out.AuthAccountRegistration;
import com.narrativex.backend.feature.auth.infrastructure.persistence.entity.AuthUserJpaEntity;
import com.narrativex.backend.feature.auth.infrastructure.persistence.repository.AuthUserJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class AuthAccountRegistrationAdapter implements AuthAccountRegistration {
  private final AuthUserJpaRepository repository;

  public AuthAccountRegistrationAdapter(AuthUserJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  public boolean existsByEmail(String email) {
    return repository.existsByEmailIgnoreCase(email);
  }

  @Override
  public void createPasswordAccount(
      String id, String email, String displayName, String passwordHash) {
    repository.save(
        new AuthUserJpaEntity(id, email, displayName, null, passwordHash, null, true));
  }
}
