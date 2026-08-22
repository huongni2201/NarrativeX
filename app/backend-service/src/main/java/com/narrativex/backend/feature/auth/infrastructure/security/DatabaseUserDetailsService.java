package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.application.service.RegisterAuthAccountService;
import com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis.AuthUserMapper;
import com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis.AuthUserRow;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DatabaseUserDetailsService implements UserDetailsService {
  private final AuthUserMapper mapper;

  @Override
  public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
    if (email == null || email.isBlank()) {
      throw new UsernameNotFoundException("Invalid credentials");
    }

    AuthUserRow user = mapper.findByEmail(RegisterAuthAccountService.normalizeEmail(email));
    if (user == null || user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
      throw new UsernameNotFoundException("Invalid credentials");
    }

    return new NarrativeXUserPrincipal(
        user.getId(),
        user.getEmail(),
        user.getDisplayName(),
        user.getAvatarUrl(),
        user.getPasswordHash(),
        user.isEnabled());
  }
}
