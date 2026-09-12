package com.narrativex.backend.feature.auth.infrastructure.desktop;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DesktopAuthenticationSuccessHandler implements AuthenticationSuccessHandler {
  private final DesktopAuthHandoffStore handoffStore;

  @Override
  public void onAuthenticationSuccess(
      HttpServletRequest request, HttpServletResponse response, Authentication authentication)
      throws IOException, ServletException {
    DesktopOAuth2AuthorizationRequestRepository.DesktopAttempt attempt =
        DesktopOAuth2AuthorizationRequestRepository.consumeDesktopAttempt(request);
    if (attempt == null) {
      response.sendError(
          HttpServletResponse.SC_BAD_REQUEST,
          "Desktop OAuth must be started through /api/v1/auth/desktop/start.");
      return;
    }

    String code = handoffStore.issue(toDesktopPrincipal(authentication), attempt.codeChallenge());
    response.sendRedirect(
        attempt.redirectUri()
            + "?code="
            + URLEncoder.encode(code, StandardCharsets.UTF_8)
            + "&attempt="
            + URLEncoder.encode(attempt.attemptId(), StandardCharsets.UTF_8));
  }

  private static DesktopUserPrincipal toDesktopPrincipal(Authentication authentication) {
    String id = authentication.getName();
    if (authentication.getPrincipal() instanceof OidcUser user) {
      return new DesktopUserPrincipal(
          id,
          firstNonBlank(user.getFullName(), user.getGivenName(), user.getEmail(), id),
          user.getEmail(),
          user.getPicture());
    }
    return new DesktopUserPrincipal(id, id, null, null);
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) return value;
    }
    return "NarrativeX user";
  }
}
