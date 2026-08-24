package com.narrativex.backend.feature.auth.infrastructure.desktop;

import java.io.Serial;
import java.io.Serializable;
import java.security.Principal;

/** Minimal server-side principal persisted in the desktop HTTP session. */
public record DesktopUserPrincipal(
    String id, String displayName, String email, String avatarUrl)
    implements Principal, Serializable {
  @Serial private static final long serialVersionUID = 1L;

  @Override
  public String getName() {
    return id;
  }
}
