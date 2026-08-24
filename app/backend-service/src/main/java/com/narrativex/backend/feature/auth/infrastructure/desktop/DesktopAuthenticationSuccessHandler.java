package com.narrativex.backend.feature.auth.infrastructure.desktop;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DesktopAuthenticationSuccessHandler implements AuthenticationSuccessHandler {
  private static final String REDIRECT_SESSION_KEY = "NARRATIVEX_DESKTOP_REDIRECT_URI";

  private final DesktopAuthHandoffStore handoffStore;

  @Value("${narrativex.security.frontend-base-url:http://localhost:3000}")
  private String frontendBaseUrl;

  @Override
  public void onAuthenticationSuccess(
      HttpServletRequest request, HttpServletResponse response, Authentication authentication)
      throws IOException, ServletException {
    Object redirect = request.getSession(false) == null
        ? null
        : request.getSession(false).getAttribute(REDIRECT_SESSION_KEY);
    if (!(redirect instanceof String redirectUri)) {
      response.sendRedirect(frontendBaseUrl);
      return;
    }
    request.getSession(false).removeAttribute(REDIRECT_SESSION_KEY);
    String code = handoffStore.issue(authentication.getName());
    response.sendRedirect(redirectUri + "?code=" + URLEncoder.encode(code, StandardCharsets.UTF_8));
  }
}
