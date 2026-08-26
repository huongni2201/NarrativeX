package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.AuthenticationException;

class DesktopAuthenticationFailureHandlerTest {
  private final DesktopAuthenticationFailureHandler handler =
      new DesktopAuthenticationFailureHandler();

  @Test
  void redirectsDesktopOAuthFailureToTheDesktopProtocol() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    HttpSession session = mock(HttpSession.class);
    AuthenticationException exception = mock(AuthenticationException.class);

    when(request.getSession(false)).thenReturn(session);
    when(session.getAttribute("NARRATIVEX_DESKTOP_REDIRECT_URI"))
        .thenReturn("narrativex://auth/callback");

    handler.onAuthenticationFailure(request, response, exception);

    verify(session).removeAttribute("NARRATIVEX_DESKTOP_REDIRECT_URI");
    verify(session).removeAttribute("NARRATIVEX_DESKTOP_CODE_CHALLENGE");
    verify(response).sendRedirect("narrativex://auth/callback?error=authentication_failed");
  }

  @Test
  void usesTheSafeDesktopRedirectWhenTheOAuthSessionIsMissing() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    AuthenticationException exception = mock(AuthenticationException.class);

    when(request.getSession(false)).thenReturn(null);

    handler.onAuthenticationFailure(request, response, exception);

    verify(response).sendRedirect("narrativex://auth/callback?error=authentication_failed");
  }
}
