package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

class DesktopAuthenticationFailureHandlerTest {
  private final DesktopAuthenticationFailureHandler handler =
      new DesktopAuthenticationFailureHandler();

  @Test
  void redirectsMatchingDesktopOAuthFailureToTheCorrelatedDesktopProtocol() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    HttpSession session = statefulSession(request);
    AuthenticationException exception = mock(AuthenticationException.class);
    String attemptId = "attempt-1";
    String state = "state-1";

    when(request.getParameter(DesktopOAuth2AuthorizationRequestRepository.DESKTOP_ATTEMPT_PARAMETER))
        .thenReturn(attemptId);
    when(request.getParameter("state")).thenReturn(state);
    DesktopOAuth2AuthorizationRequestRepository.storePendingDesktopAttempt(
        session, attemptId, "narrativex://auth/callback", "a".repeat(43));
    new DesktopOAuth2AuthorizationRequestRepository()
        .saveAuthorizationRequest(authorizationRequest(state), request, response);

    handler.onAuthenticationFailure(request, response, exception);

    verify(response)
        .sendRedirect("narrativex://auth/callback?error=authentication_failed&attempt=attempt-1");
  }

  @Test
  void usesTheSafeDesktopRedirectWhenTheOAuthSessionIsMissing() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    AuthenticationException exception = mock(AuthenticationException.class);

    when(request.getParameter("state")).thenReturn("missing-state");
    when(request.getSession(false)).thenReturn(null);

    handler.onAuthenticationFailure(request, response, exception);

    verify(response).sendRedirect("narrativex://auth/callback?error=authentication_failed");
  }

  private static HttpSession statefulSession(HttpServletRequest request) {
    HttpSession session = mock(HttpSession.class);
    Map<String, Object> attributes = new HashMap<>();
    when(request.getSession(true)).thenReturn(session);
    when(request.getSession(false)).thenReturn(session);
    when(session.getAttribute(anyString()))
        .thenAnswer(invocation -> attributes.get(invocation.getArgument(0)));
    doAnswer(
            invocation -> {
              attributes.put(invocation.getArgument(0), invocation.getArgument(1));
              return null;
            })
        .when(session)
        .setAttribute(anyString(), any());
    doAnswer(
            invocation -> {
              attributes.remove(invocation.getArgument(0));
              return null;
            })
        .when(session)
        .removeAttribute(anyString());
    return session;
  }

  private static OAuth2AuthorizationRequest authorizationRequest(String state) {
    return OAuth2AuthorizationRequest.authorizationCode()
        .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
        .clientId("client")
        .redirectUri("https://api.narrativex.cloud/login/oauth2/code/google")
        .state(state)
        .build();
  }
}
