package com.narrativex.backend.feature.auth.api.controller;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.api.request.DesktopAuthExchangeRequest;
import com.narrativex.backend.feature.auth.api.request.DesktopGuestSessionRequest;
import com.narrativex.backend.feature.auth.application.port.in.DesktopAuthHandoff;
import com.narrativex.backend.feature.auth.application.port.in.DesktopGuestIdentity;
import com.narrativex.backend.feature.auth.application.port.in.DesktopUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;

class DesktopAuthControllerTest {
  private static final String DEVICE_ID = "00000000-0000-4000-8000-000000000001";
  private static final String DEVICE_SECRET = "s".repeat(43);

  @AfterEach
  void clearSecurityContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void acceptsCanonicalNarrativeXCallback() {
    assertTrue(DesktopAuthController.isAllowedRedirect("narrativex://auth/callback"));
  }

  @Test
  void acceptsOnlyS256LengthBase64UrlChallenges() {
    assertTrue(DesktopAuthController.isAllowedCodeChallenge("a".repeat(43)));
    assertFalse(DesktopAuthController.isAllowedCodeChallenge("a".repeat(42)));
    assertFalse(DesktopAuthController.isAllowedCodeChallenge("a".repeat(43) + "="));
    assertFalse(DesktopAuthController.isAllowedCodeChallenge("a".repeat(87)));
  }

  @Test
  void exchangeRequestRequiresABase64UrlVerifier() {
    var verifier = DesktopAuthExchangeRequest.class.getRecordComponents()[1].getAccessor();
    assertTrue(verifier.isAnnotationPresent(NotBlank.class));
    assertEquals("[A-Za-z0-9_-]{43,86}", verifier.getAnnotation(Pattern.class).regexp());
  }

  @Test
  void guestRequestRequiresInstallationCredentials() {
    var components = DesktopGuestSessionRequest.class.getRecordComponents();
    var deviceId = components[0].getAccessor();
    var secret = components[1].getAccessor();
    assertTrue(deviceId.isAnnotationPresent(NotBlank.class));
    assertTrue(secret.isAnnotationPresent(NotBlank.class));
    assertEquals("[A-Za-z0-9_-]{43}", secret.getAnnotation(Pattern.class).regexp());
  }

  @Test
  void rejectsLookalikeOrMutatedCallbacks() {
    assertFalse(DesktopAuthController.isAllowedRedirect("narrativex:/auth/callback"));
    assertFalse(DesktopAuthController.isAllowedRedirect("https://auth/callback"));
    assertFalse(DesktopAuthController.isAllowedRedirect("narrativex://evil/callback"));
    assertFalse(
        DesktopAuthController.isAllowedRedirect(
            "narrativex://auth/callback?next=https://evil.example"));
    assertFalse(DesktopAuthController.isAllowedRedirect("narrativex://auth/callback#fragment"));
  }

  @Test
  void desktopStartMovesBrowserToConfiguredPublicOriginBeforeCreatingSession() throws Exception {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    DesktopAuthController controller =
        new DesktopAuthController(
            handoffStore, guestIdentity, securityContextRepository, "https://auth.example.com");
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    String challenge = "a".repeat(43);
    when(request.getScheme()).thenReturn("http");
    when(request.getServerName()).thenReturn("localhost");
    when(request.getServerPort()).thenReturn(8080);

    controller.start("narrativex://auth/callback", challenge, request, response);

    verify(response)
        .sendRedirect(
            "https://auth.example.com/api/v1/auth/desktop/start?redirect_uri=narrativex%3A%2F%2Fauth%2Fcallback&code_challenge="
                + challenge);
    verify(request, never()).getSession(true);
  }

  @Test
  void desktopStartOnConfiguredPublicOriginCreatesOAuthSessionThere() throws Exception {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    DesktopAuthController controller =
        new DesktopAuthController(
            handoffStore, guestIdentity, securityContextRepository, "https://auth.example.com");
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    HttpSession session = mock(HttpSession.class);
    String challenge = "b".repeat(43);
    when(request.getScheme()).thenReturn("https");
    when(request.getServerName()).thenReturn("auth.example.com");
    when(request.getServerPort()).thenReturn(443);
    when(request.getSession(true)).thenReturn(session);

    controller.start("narrativex://auth/callback", challenge, request, response);

    verify(session).setAttribute("NARRATIVEX_DESKTOP_REDIRECT_URI", "narrativex://auth/callback");
    verify(session).setAttribute("NARRATIVEX_DESKTOP_CODE_CHALLENGE", challenge);
    verify(response).sendRedirect("/oauth2/authorization/google");
  }

  @Test
  void guestSessionResumesStableInstallationIdentity() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    when(guestIdentity.establish(DEVICE_ID, DEVICE_SECRET)).thenReturn("guest-stable");
    DesktopAuthController controller =
        new DesktopAuthController(handoffStore, guestIdentity, securityContextRepository);
    HttpServletRequest servletRequest = mock(HttpServletRequest.class);
    HttpServletResponse servletResponse = mock(HttpServletResponse.class);

    var result =
        controller.guest(
            new DesktopGuestSessionRequest(DEVICE_ID, DEVICE_SECRET),
            servletRequest,
            servletResponse);

    assertEquals(HttpStatus.OK, result.getStatusCode());
    assertTrue(result.getBody().data().guest());
    assertEquals("guest-stable", result.getBody().data().id());
    verify(securityContextRepository).saveContext(any(), eq(servletRequest), eq(servletResponse));
    verifyNoInteractions(handoffStore);
  }

  @Test
  void guestBootstrapMigratesAnExistingEphemeralGuestToStableIdentity() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    when(guestIdentity.establish(DEVICE_ID, DEVICE_SECRET)).thenReturn("guest-stable");
    SecurityContextHolder.getContext()
        .setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated(
                "guest-legacy",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_GUEST"))));
    DesktopAuthController controller =
        new DesktopAuthController(handoffStore, guestIdentity, securityContextRepository);

    controller.guest(
        new DesktopGuestSessionRequest(DEVICE_ID, DEVICE_SECRET),
        mock(HttpServletRequest.class),
        mock(HttpServletResponse.class));

    verify(guestIdentity).transferOwnership("guest-legacy", "guest-stable");
  }

  @Test
  void exchangeWithMatchingVerifierRotatesExistingSessionBeforePrivilegeUpgrade() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    DesktopAuthController controller =
        new DesktopAuthController(handoffStore, guestIdentity, securityContextRepository);
    HttpServletRequest servletRequest = mock(HttpServletRequest.class);
    HttpServletResponse servletResponse = mock(HttpServletResponse.class);
    HttpSession session = mock(HttpSession.class);
    when(servletRequest.getSession(false)).thenReturn(session);
    String verifier = "a".repeat(43);
    DesktopAuthHandoff.AuthenticatedUser user =
        new DesktopAuthHandoff.AuthenticatedUser("user-1", "User", null, null);
    when(handoffStore.consumeUser("code", verifier)).thenReturn(user);

    var result =
        controller.exchange(
            new DesktopAuthExchangeRequest("code", verifier), servletRequest, servletResponse);

    assertEquals(HttpStatus.OK, result.getStatusCode());
    assertFalse(result.getBody().data().guest());
    verify(servletRequest).changeSessionId();
    verify(securityContextRepository).saveContext(any(), eq(servletRequest), eq(servletResponse));
  }

  @Test
  void exchangeStoresSerializablePrincipalWithStableUserName() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    DesktopAuthController controller =
        new DesktopAuthController(handoffStore, guestIdentity, securityContextRepository);
    String verifier = "d".repeat(43);
    when(handoffStore.consumeUser("code", verifier))
        .thenReturn(
            new DesktopAuthHandoff.AuthenticatedUser(
                "user-1", "Narrative User", "user@example.test", "avatar"));

    controller.exchange(
        new DesktopAuthExchangeRequest("code", verifier),
        mock(HttpServletRequest.class),
        mock(HttpServletResponse.class));

    var context = SecurityContextHolder.getContext();
    assertEquals("user-1", context.getAuthentication().getName());
    assertTrue(context.getAuthentication().getPrincipal() instanceof DesktopUserPrincipal);
    assertDoesNotThrow(
        () -> {
          try (var bytes = new ByteArrayOutputStream(); var output = new ObjectOutputStream(bytes)) {
            output.writeObject(context);
          }
        });
  }

  @Test
  void exchangeTransfersGuestOwnershipBeforeSwitchingToGoogleUser() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    String verifier = "a".repeat(43);
    when(handoffStore.consumeUser("code", verifier))
        .thenReturn(new DesktopAuthHandoff.AuthenticatedUser("user-1", "User", null, null));
    SecurityContextHolder.getContext()
        .setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated(
                "guest-stable",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_GUEST"))));
    DesktopAuthController controller =
        new DesktopAuthController(handoffStore, guestIdentity, securityContextRepository);

    controller.exchange(
        new DesktopAuthExchangeRequest("code", verifier),
        mock(HttpServletRequest.class),
        mock(HttpServletResponse.class));

    verify(guestIdentity).transferOwnership("guest-stable", "user-1");
  }

  @Test
  void exchangeWithoutExistingSessionStillEstablishesSession() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    DesktopAuthController controller =
        new DesktopAuthController(handoffStore, guestIdentity, securityContextRepository);
    HttpServletRequest servletRequest = mock(HttpServletRequest.class);
    HttpServletResponse servletResponse = mock(HttpServletResponse.class);
    String verifier = "c".repeat(43);
    DesktopAuthHandoff.AuthenticatedUser user =
        new DesktopAuthHandoff.AuthenticatedUser("user-1", "User", null, null);
    when(handoffStore.consumeUser("code", verifier)).thenReturn(user);

    var result =
        controller.exchange(
            new DesktopAuthExchangeRequest("code", verifier), servletRequest, servletResponse);

    assertEquals(HttpStatus.OK, result.getStatusCode());
    verify(securityContextRepository).saveContext(any(), eq(servletRequest), eq(servletResponse));
  }

  @Test
  void wrongVerifierReturnsUnauthorizedAndDoesNotEstablishASession() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    DesktopGuestIdentity guestIdentity = mock(DesktopGuestIdentity.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    DesktopAuthController controller =
        new DesktopAuthController(handoffStore, guestIdentity, securityContextRepository);
    String verifier = "b".repeat(43);
    when(handoffStore.consumeUser("code", verifier)).thenReturn(null);

    var result =
        controller.exchange(
            new DesktopAuthExchangeRequest("code", verifier),
            mock(HttpServletRequest.class),
            mock(HttpServletResponse.class));

    assertEquals(HttpStatus.UNAUTHORIZED, result.getStatusCode());
    verifyNoInteractions(securityContextRepository);
  }
}
