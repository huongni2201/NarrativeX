package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.api.response.CurrentUserResponse;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserProfile;
import com.narrativex.backend.feature.auth.application.port.in.DesktopUserPrincipal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SecurityContextCurrentUser implements CurrentUserId, CurrentUserProfile {
  @Override
  public String get() {
    return authenticated().getName();
  }

  @Override
  public CurrentUserResponse current() {
    Authentication authentication = authenticated();
    String id = authentication.getName();
    if (hasAuthority(authentication, "ROLE_GUEST")) {
      return new CurrentUserResponse(id, "Khách", null, null, true);
    }
    if (authentication.getPrincipal() instanceof OidcUser user) {
      return new CurrentUserResponse(
          id,
          firstNonBlank(user.getFullName(), user.getGivenName(), user.getEmail(), id),
          user.getEmail(),
          user.getPicture(),
          false);
    }
    if (authentication.getPrincipal() instanceof DesktopUserPrincipal user) {
      return new CurrentUserResponse(
          user.id(), user.displayName(), user.email(), user.avatarUrl(), false);
    }
    log.debug("Resolved authenticated principal {}", id);
    return new CurrentUserResponse(id, id, null, null, false);
  }

  private static Authentication authenticated() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null
        || !authentication.isAuthenticated()
        || authentication.getName() == null
        || authentication.getName().isBlank()) {
      throw new AuthenticationCredentialsNotFoundException("Authenticated user is required");
    }
    return authentication;
  }

  private static boolean hasAuthority(Authentication authentication, String authority) {
    return authentication.getAuthorities().stream()
        .anyMatch(grantedAuthority -> authority.equals(grantedAuthority.getAuthority()));
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) if (value != null && !value.isBlank()) return value;
    return null;
  }
}
