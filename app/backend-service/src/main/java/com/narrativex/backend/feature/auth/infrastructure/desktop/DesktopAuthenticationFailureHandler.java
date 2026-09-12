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
  private static final String DEFAULT_DESKTOP_REDIRECT_URI = "narrativex://auth/callback";

  @Override
  public void onAuthenticationFailure(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
      throws IOException {
    var session = request.getSession(false);
    log.warn(
        "Desktop OAuth authentication failed correlationId={} sessionPresent={} exceptionType={} message={}",
        CorrelationIdFilter.correlationId(request),
        session != null,
        exception.getClass().getName(),
        exception.getMessage(),
        exception);

    DesktopOAuth2AuthorizationRequestRepository.DesktopAttempt attempt =
        DesktopOAuth2AuthorizationRequestRepository.consumeDesktopAttempt(request);
    String redirectUri =
        attempt != null && isAllowedRedirect(attempt.redirectUri())
            ? attempt.redirectUri()
            : DEFAULT_DESKTOP_REDIRECT_URI;
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