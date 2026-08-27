package com.narrativex.backend.feature.auth.application.port.in;

import java.io.Serial;
import java.io.Serializable;
import java.security.Principal;

/** Serializable desktop principal shared by the API and security adapters. */
public record DesktopUserPrincipal(String id, String displayName, String email, String avatarUrl)
    implements Principal, Serializable {
  @Serial private static final long serialVersionUID = 1L;

  @Override
  public String getName() {
    return id;
  }
}
