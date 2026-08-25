package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

class DesktopAuthenticationSuccessHandlerTest {
  private final DesktopAuthHandoffStore handoffStore = mock(DesktopAuthHandoffStore.class);
  private final DesktopAuthenticationSuccessHandler handler =
      new DesktopAuthenticationSuccessHandler(handoffStore);

  @Test
  void rejectsOAuthCompletionThatDidNotStartThroughDesktopEndpoint() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    Authentication authentication = mock(Authentication.class);

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
    HttpSession session = mock(HttpSession.class);
    Authentication authentication = mock(Authentication.class);
    String redirectUri = "narrativex://auth/callback";
    String codeChallenge = "a".repeat(43);

    when(request.getSession(false)).thenReturn(session);
    when(session.getAttribute("NARRATIVEX_DESKTOP_REDIRECT_URI")).thenReturn(redirectUri);
    when(session.getAttribute("NARRATIVEX_DESKTOP_CODE_CHALLENGE")).thenReturn(codeChallenge);
    when(authentication.getName()).thenReturn("user-1");
    when(handoffStore.issue(
            new DesktopUserPrincipal("user-1", "user-1", null, null), codeChallenge))
        .thenReturn("one-time-code");

    handler.onAuthenticationSuccess(request, response, authentication);

    verify(session).removeAttribute("NARRATIVEX_DESKTOP_REDIRECT_URI");
    verify(session).removeAttribute("NARRATIVEX_DESKTOP_CODE_CHALLENGE");
    verify(response).sendRedirect("narrativex://auth/callback?code=one-time-code");
  }

  @Test
  void rejectsOAuthCompletionWithoutTheInitiatingCodeChallenge() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    HttpSession session = mock(HttpSession.class);
    Authentication authentication = mock(Authentication.class);

    when(request.getSession(false)).thenReturn(session);
    when(session.getAttribute("NARRATIVEX_DESKTOP_REDIRECT_URI"))
        .thenReturn("narrativex://auth/callback");

    handler.onAuthenticationSuccess(request, response, authentication);

    verify(response)
        .sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Desktop OAuth must be started through /api/v1/auth/desktop/start.");
    verifyNoInteractions(handoffStore);
  }
}
