package com.narrativex.backend.feature.auth.infrastructure.security;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public final class NarrativeXUserPrincipal
    implements UserDetails, CredentialsContainer, Serializable {
  @Serial private static final long serialVersionUID = 1L;

  private final String id;
  private final String email;
  private final String displayName;
  private final String avatarUrl;
  private transient String passwordHash;
  private final boolean enabled;

  public NarrativeXUserPrincipal(
      String id,
      String email,
      String displayName,
      String avatarUrl,
      String passwordHash,
      boolean enabled) {
    this.id = id;
    this.email = email;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
    this.passwordHash = passwordHash;
    this.enabled = enabled;
  }

  public String id() {
    return id;
  }

  public String email() {
    return email;
  }

  public String displayName() {
    return displayName;
  }

  public String avatarUrl() {
    return avatarUrl;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_USER"));
  }

  @Override
  public String getPassword() {
    return passwordHash;
  }

  @Override
  public String getUsername() {
    return id;
  }

  @Override
  public boolean isAccountNonExpired() {
    return enabled;
  }

  @Override
  public boolean isAccountNonLocked() {
    return enabled;
  }

  @Override
  public boolean isCredentialsNonExpired() {
    return enabled;
  }

  @Override
  public boolean isEnabled() {
    return enabled;
  }

  @Override
  public void eraseCredentials() {
    passwordHash = null;
  }
}
