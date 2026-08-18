package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.application.port.out.PasswordHashing;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class SpringPasswordHashing implements PasswordHashing {
  private final PasswordEncoder passwordEncoder;

  public SpringPasswordHashing(PasswordEncoder passwordEncoder) {
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  public String encode(String rawPassword) {
    return passwordEncoder.encode(rawPassword);
  }
}
