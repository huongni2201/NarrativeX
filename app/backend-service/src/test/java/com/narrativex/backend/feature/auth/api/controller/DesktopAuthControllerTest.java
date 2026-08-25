package com.narrativex.backend.feature.auth.api.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.api.request.DesktopAuthExchangeRequest;
import com.narrativex.backend.feature.auth.application.port.in.DesktopAuthHandoff;
import com.narrativex.backend.feature.auth.application.usecase.TransferGuestWorkspaceUseCase;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;

class DesktopAuthControllerTest {
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
    var verifier = DesktopAuthExchangeRequest.class.getRecordComponents()[1];
    assertTrue(verifier.isAnnotationPresent(NotBlank.class));
    assertEquals("[A-Za-z0-9_-]{43,86}", verifier.getAnnotation(Pattern.class).regexp());
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
  void guestSessionEstablishesRoleGuestWithoutOpeningOAuth() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    TransferGuestWorkspaceUseCase transferGuestWorkspaceUseCase =
        mock(TransferGuestWorkspaceUseCase.class);
    DesktopAuthController controller =
        new DesktopAuthController(
            handoffStore, securityContextRepository, transferGuestWorkspaceUseCase);
    HttpServletRequest servletRequest = mock(HttpServletRequest.class);
    HttpServletResponse servletResponse = mock(HttpServletResponse.class);

    var result = controller.guest(servletRequest, servletResponse);

    assertEquals(HttpStatus.OK, result.getStatusCode());
    assertTrue(result.getBody().data().guest());
    assertTrue(result.getBody().data().id().startsWith("guest-"));
    verify(securityContextRepository).saveContext(any(), eq(servletRequest), eq(servletResponse));
    verifyNoInteractions(handoffStore, transferGuestWorkspaceUseCase);
  }

  @Test
  void exchangeWithMatchingVerifierEstablishesTheSession() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    TransferGuestWorkspaceUseCase transferGuestWorkspaceUseCase =
        mock(TransferGuestWorkspaceUseCase.class);
    DesktopAuthController controller =
        new DesktopAuthController(
            handoffStore, securityContextRepository, transferGuestWorkspaceUseCase);
    HttpServletRequest servletRequest = mock(HttpServletRequest.class);
    HttpServletResponse servletResponse = mock(HttpServletResponse.class);
    String verifier = "a".repeat(43);
    DesktopAuthHandoff.AuthenticatedUser user =
        new DesktopAuthHandoff.AuthenticatedUser("user-1", "User", null, null);
    when(handoffStore.consumeUser("code", verifier)).thenReturn(user);

    var result =
        controller.exchange(
            new DesktopAuthExchangeRequest("code", verifier), servletRequest, servletResponse);

    assertEquals(HttpStatus.OK, result.getStatusCode());
    assertFalse(result.getBody().data().guest());
    verify(securityContextRepository).saveContext(any(), eq(servletRequest), eq(servletResponse));
    verifyNoInteractions(transferGuestWorkspaceUseCase);
  }

  @Test
  void wrongVerifierReturnsUnauthorizedAndDoesNotEstablishASession() {
    DesktopAuthHandoff handoffStore = mock(DesktopAuthHandoff.class);
    SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    TransferGuestWorkspaceUseCase transferGuestWorkspaceUseCase =
        mock(TransferGuestWorkspaceUseCase.class);
    DesktopAuthController controller =
        new DesktopAuthController(
            handoffStore, securityContextRepository, transferGuestWorkspaceUseCase);
    String verifier = "b".repeat(43);
    when(handoffStore.consumeUser("code", verifier)).thenReturn(null);

    var result =
        controller.exchange(
            new DesktopAuthExchangeRequest("code", verifier),
            mock(HttpServletRequest.class),
            mock(HttpServletResponse.class));

    assertEquals(HttpStatus.UNAUTHORIZED, result.getStatusCode());
    verifyNoInteractions(securityContextRepository, transferGuestWorkspaceUseCase);
  }
}
