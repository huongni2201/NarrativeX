package com.narrativex.backend.feature.auth.infrastructure.security;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collection;
import java.util.Map;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

@RequiredArgsConstructor

public final class NarrativeXOidcUser implements OidcUser, Serializable {
  @Serial private static final long serialVersionUID = 1L;

  private final String userId;
  private final OidcUser delegate;

  @Override
  public String getName() {
    return userId;
  }

  @Override
  public Map<String, Object> getClaims() {
    return delegate.getClaims();
  }

  @Override
  public OidcUserInfo getUserInfo() {
    return delegate.getUserInfo();
  }

  @Override
  public OidcIdToken getIdToken() {
    return delegate.getIdToken();
  }

  @Override
  public Map<String, Object> getAttributes() {
    return delegate.getAttributes();
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return delegate.getAuthorities();
  }
}
