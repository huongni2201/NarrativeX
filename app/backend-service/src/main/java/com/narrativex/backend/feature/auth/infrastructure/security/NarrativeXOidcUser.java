package com.narrativex.backend.feature.auth.infrastructure.security;

import java.util.Collection;
import java.util.Map;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

public final class NarrativeXOidcUser implements OidcUser {
  private final String userId;
  private final OidcUser delegate;

  public NarrativeXOidcUser(String userId, OidcUser delegate) {
    this.userId = userId;
    this.delegate = delegate;
  }

  @Override
  public String getName() { return userId; }

  @Override
  public Map<String, Object> getClaims() { return delegate.getClaims(); }

  @Override
  public OidcUserInfo getUserInfo() { return delegate.getUserInfo(); }

  @Override
  public OidcIdToken getIdToken() { return delegate.getIdToken(); }

  @Override
  public Map<String, Object> getAttributes() { return delegate.getAttributes(); }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() { return delegate.getAuthorities(); }
}
