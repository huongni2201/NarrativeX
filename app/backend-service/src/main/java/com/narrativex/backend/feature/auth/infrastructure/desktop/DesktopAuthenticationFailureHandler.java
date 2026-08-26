package com.narrativex.backend.feature.auth.infrastructure.desktop;

import com.narrativex.backend.feature.common.api.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class DesktopAuthenticationFailureHandler implements AuthenticationFailureHandler {
  private static final String REDIRECT_SESSION_KEY = "NARRATIVEX_DESKTOP_REDIRECT_URI";
  private static final String CODE_CHALLENGE_SESSION_KEY = "NARRATIVEX_DESKTOP_CODE_CHALLENGE";

  @Override
  public void onAuthenticationFailure(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
      throws IOException {
    log.warn(
        "Desktop OAuth authentication failed correlationId={} exceptionType={} message={}",
        CorrelationIdFilter.correlationId(request),
        exception.getClass().getName(),
        exception.getMessage(),
        exception);

    var session = request.getSession(false);
    Object redirect = session == null ? null : session.getAttribute(REDIRECT_SESSION_KEY);
    if (!(redirect instanceof String redirectUri) || !isAllowedRedirect(redirectUri)) {
      response.sendError(
          HttpServletResponse.SC_UNAUTHORIZED, "Desktop OAuth authentication failed.");
      return;
    }

    session.removeAttribute(REDIRECT_SESSION_KEY);
    session.removeAttribute(CODE_CHALLENGE_SESSION_KEY);
    response.sendRedirect(redirectUri + "?error=authentication_failed");
  }

  private static boolean isAllowedRedirect(String redirectUri) {
    try {
      URI uri = new URI(redirectUri);
      return "narrativex".equalsIgnoreCase(uri.getScheme())
          && "auth".equalsIgnoreCase(uri.getHost())
          && "/callback".equals(uri.getPath())
          && uri.getUserInfo() == null
          && uri.getPort() == -1
          && uri.getQuery() == null
          && uri.getFragment() == null;
    } catch (URISyntaxException exception) {
      return false;
    }
  }
}
