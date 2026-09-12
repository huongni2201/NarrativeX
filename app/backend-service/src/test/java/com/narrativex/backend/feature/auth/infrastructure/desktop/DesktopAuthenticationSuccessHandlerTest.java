package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

class DesktopAuthenticationSuccessHandlerTest {
  private final DesktopAuthHandoffStore handoffStore = mock(DesktopAuthHandoffStore.class);
  private final DesktopAuthenticationSuccessHandler handler =
      new DesktopAuthenticationSuccessHandler(handoffStore);

  @Test
  void rejectsOAuthCompletionThatDidNotStartThroughDesktopEndpoint() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    Authentication authentication = mock(Authentication.class);

    when(request.getParameter("state")).thenReturn("missing-state");
    when(request.getSession(false)).thenReturn(null);

    handler.onAuthenticationSuccess(request, response, authentication);

    verify(response)
        .sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Desktop OAuth must be started through /api/v1/auth/desktop/start.");
    verifyNoInteractions(handoffStore);
  }

  @Test
  void officialDesktopFlowIssuesOneTimeCodeAndRedirectsToCustomProtocol() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    HttpSession session = statefulSession(request);
    Authentication authentication = mock(Authentication.class);
    String redirectUri = "narrativex://auth/callback";
    String codeChallenge = "a".repeat(43);
    String state = "state-1";
    String attemptId = "attempt-1";

    when(request.getParameter(DesktopOAuth2AuthorizationRequestRepository.DESKTOP_ATTEMPT_PARAMETER))
        .thenReturn(attemptId);
    when(request.getParameter("state")).thenReturn(state);
    DesktopOAuth2AuthorizationRequestRepository.storePendingDesktopAttempt(
        session, attemptId, redirectUri, codeChallenge);
    new DesktopOAuth2AuthorizationRequestRepository()
        .saveAuthorizationRequest(authorizationRequest(state), request, response);

    when(authentication.getName()).thenReturn("user-1");
    when(handoffStore.issue(
            new DesktopUserPrincipal("user-1", "user-1", null, null), codeChallenge))
        .thenReturn("one-time-code");

    handler.onAuthenticationSuccess(request, response, authentication);

    verify(response).sendRedirect("narrativex://auth/callback?code=one-time-code");
  }

  @Test
  void rejectsOAuthCompletionWithoutStateBoundDesktopAttempt() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    statefulSession(request);
    Authentication authentication = mock(Authentication.class);

    when(request.getParameter("state")).thenReturn("state-without-desktop-attempt");

    handler.onAuthenticationSuccess(request, response, authentication);

    verify(response)
        .sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Desktop OAuth must be started through /api/v1/auth/desktop/start.");
    verifyNoInteractions(handoffStore);
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