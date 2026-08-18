package com.narrativex.backend.feature.auth.infrastructure.persistence.repository;

import com.narrativex.backend.feature.auth.infrastructure.persistence.entity.AuthUserJpaEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthUserJpaRepository extends JpaRepository<AuthUserJpaEntity, String> {
  Optional<AuthUserJpaEntity> findByEmailIgnoreCase(String email);

  Optional<AuthUserJpaEntity> findByGoogleSubject(String googleSubject);

  boolean existsByEmailIgnoreCase(String email);
}
