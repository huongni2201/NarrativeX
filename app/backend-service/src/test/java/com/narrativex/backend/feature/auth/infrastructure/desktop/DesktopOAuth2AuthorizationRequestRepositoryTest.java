package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

class DesktopOAuth2AuthorizationRequestRepositoryTest {
  private final DesktopOAuth2AuthorizationRequestRepository repository =
      new DesktopOAuth2AuthorizationRequestRepository();

  @Test
  void preservesAuthorizationRequestsWhenMultipleLoginTabsUseOneSession() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
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

    OAuth2AuthorizationRequest first = authorizationRequest("state-first");
    OAuth2AuthorizationRequest second = authorizationRequest("state-second");
    when(request.getParameter("state"))
        .thenReturn("state-first", "state-second", "state-first", "state-second");

    repository.saveAuthorizationRequest(first, request, response);
    repository.saveAuthorizationRequest(second, request, response);

    assertThat(repository.loadAuthorizationRequest(request)).isSameAs(first);
    assertThat(repository.loadAuthorizationRequest(request)).isSameAs(second);
    assertThat(repository.removeAuthorizationRequest(request, response)).isSameAs(first);
    assertThat(repository.loadAuthorizationRequest(request)).isSameAs(second);
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
