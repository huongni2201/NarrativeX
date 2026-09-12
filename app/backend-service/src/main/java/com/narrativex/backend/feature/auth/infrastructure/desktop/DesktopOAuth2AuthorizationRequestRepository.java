package com.narrativex.backend.feature.auth.infrastructure.desktop;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

/**
 * Keeps pending OAuth requests and their desktop PKCE metadata independent when a user opens more
 * than one Google login tab.
 */
@Component
public final class DesktopOAuth2AuthorizationRequestRepository
    implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {
  public static final String DESKTOP_ATTEMPT_PARAMETER = "desktop_attempt";
  private static final String ATTRIBUTE_PREFIX = "NARRATIVEX_OAUTH2_AUTHORIZATION_REQUEST:";
  private static final String INDEX_ATTRIBUTE = "NARRATIVEX_OAUTH2_AUTHORIZATION_REQUEST_INDEX";
  private static final String PENDING_ATTEMPT_PREFIX = "NARRATIVEX_DESKTOP_OAUTH_PENDING:";
  private static final String STATE_ATTEMPT_PREFIX = "NARRATIVEX_DESKTOP_OAUTH_STATE:";
  private static final int MAX_PENDING_REQUESTS = 8;

  public record DesktopAttempt(String redirectUri, String codeChallenge) {}

  public static void storePendingDesktopAttempt(
      HttpSession session, String attemptId, String redirectUri, String codeChallenge) {
    synchronized (session) {
      session.setAttribute(
          pendingAttemptName(attemptId), new DesktopAttempt(redirectUri, codeChallenge));
    }
  }

  public static DesktopAttempt consumeDesktopAttempt(HttpServletRequest request) {
    String state = request.getParameter("state");
    if (state == null || state.isBlank()) return null;
    HttpSession session = request.getSession(false);
    if (session == null) return null;
    synchronized (session) {
      String attribute = stateAttemptName(state);
      Object value = session.getAttribute(attribute);
      session.removeAttribute(attribute);
      return value instanceof DesktopAttempt attempt ? attempt : null;
    }
  }

  @Override
  public void saveAuthorizationRequest(
      OAuth2AuthorizationRequest authorizationRequest,
      HttpServletRequest request,
      HttpServletResponse response) {
    if (authorizationRequest == null) {
      removeAuthorizationRequest(request, response);
      return;
    }

    String state = Objects.requireNonNull(authorizationRequest.getState(), "OAuth state");
    if (state.isBlank()) throw new IllegalArgumentException("OAuth state must not be blank");

    HttpSession session = request.getSession(true);
    synchronized (session) {
      String attemptId = request.getParameter(DESKTOP_ATTEMPT_PARAMETER);
      if (attemptId != null && !attemptId.isBlank()) {
        String pendingName = pendingAttemptName(attemptId);
        Object pending = session.getAttribute(pendingName);
        if (pending instanceof DesktopAttempt) {
          session.setAttribute(stateAttemptName(state), pending);
          session.removeAttribute(pendingName);
        }
      }

      session.setAttribute(attributeName(state), authorizationRequest);
      Set<String> index = readIndex(session);
      index.remove(state);
      index.add(state);
      while (index.size() > MAX_PENDING_REQUESTS) {
        String oldestState = index.iterator().next();
        index.remove(oldestState);
        session.removeAttribute(attributeName(oldestState));
        session.removeAttribute(stateAttemptName(oldestState));
      }
      session.setAttribute(INDEX_ATTRIBUTE, index);
    }
  }

  @Override
  public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
    String state = request.getParameter("state");
    if (state == null || state.isBlank()) return null;
    HttpSession session = request.getSession(false);
    return session == null
        ? null
        : (OAuth2AuthorizationRequest) session.getAttribute(attributeName(state));
  }

  @Override
  public OAuth2AuthorizationRequest removeAuthorizationRequest(
      HttpServletRequest request, HttpServletResponse response) {
    String state = request.getParameter("state");
    if (state == null || state.isBlank()) return null;
    HttpSession session = request.getSession(false);
    if (session == null) return null;

    synchronized (session) {
      OAuth2AuthorizationRequest authorizationRequest =
          (OAuth2AuthorizationRequest) session.getAttribute(attributeName(state));
      if (authorizationRequest == null) return null;
      session.removeAttribute(attributeName(state));
      Set<String> index = readIndex(session);
      index.remove(state);
      if (index.isEmpty()) {
        session.removeAttribute(INDEX_ATTRIBUTE);
      } else {
        session.setAttribute(INDEX_ATTRIBUTE, index);
      }
      // Keep state-bound desktop metadata until the success/failure handler consumes it.
      return authorizationRequest;
    }
  }

  private static Set<String> readIndex(HttpSession session) {
    Object value = session.getAttribute(INDEX_ATTRIBUTE);
    if (!(value instanceof Set<?> stored)) return new LinkedHashSet<>();
    LinkedHashSet<String> index = new LinkedHashSet<>();
    for (Object state : stored) {
      if (state instanceof String candidate && !candidate.isBlank()) index.add(candidate);
    }
    return index;
  }

  private static String pendingAttemptName(String attemptId) {
    return PENDING_ATTEMPT_PREFIX + hashState(attemptId);
  }

  private static String stateAttemptName(String state) {
    return STATE_ATTEMPT_PREFIX + hashState(state);
  }

  private static String attributeName(String state) {
    return ATTRIBUTE_PREFIX + hashState(state);
  }

  private static String hashState(String state) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(state.getBytes(StandardCharsets.UTF_8));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is required for OAuth state storage", exception);
    }
  }
}