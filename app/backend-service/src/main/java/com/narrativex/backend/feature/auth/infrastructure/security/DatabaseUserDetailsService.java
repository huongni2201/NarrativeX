package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.application.service.RegisterAuthAccountService;
import com.narrativex.backend.feature.auth.infrastructure.persistence.entity.AuthUserJpaEntity;
import com.narrativex.backend.feature.auth.infrastructure.persistence.repository.AuthUserJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DatabaseUserDetailsService implements UserDetailsService {
  private final AuthUserJpaRepository repository;

  @Override
  public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
    if (email == null || email.isBlank()) {
      throw new UsernameNotFoundException("Invalid credentials");
    }

    AuthUserJpaEntity user =
        repository
            .findByEmailIgnoreCase(RegisterAuthAccountService.normalizeEmail(email))
            .filter(
                candidate ->
                    candidate.getPasswordHash() != null && !candidate.getPasswordHash().isBlank())
        .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));

    return new NarrativeXUserPrincipal(
        user.getId(), user.getEmail(), user.getDisplayName(), user.getAvatarUrl(),
        user.getPasswordHash(), user.isEnabled());
  }
}
