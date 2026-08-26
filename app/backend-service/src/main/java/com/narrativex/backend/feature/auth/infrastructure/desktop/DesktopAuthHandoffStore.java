package com.narrativex.backend.feature.auth.infrastructure.desktop;

import com.narrativex.backend.feature.auth.application.port.in.DesktopAuthHandoff;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * PostgreSQL-backed, single-use desktop OAuth handoff codes. Raw codes are never persisted or
 * logged. Consumption is an atomic DELETE ... RETURNING operation.
 */
@Component
@RequiredArgsConstructor
public class DesktopAuthHandoffStore implements DesktopAuthHandoff {
  private static final Duration CODE_TTL = Duration.ofSeconds(90);
  private static final String CODE_CHALLENGE_PATTERN = "[A-Za-z0-9_-]{43}";
  private static final String CODE_VERIFIER_PATTERN = "[A-Za-z0-9_-]{43,86}";

  private final DesktopAuthHandoffMapper mapper;
  private final SecureRandom secureRandom = new SecureRandom();

  public String issue(DesktopUserPrincipal user, String codeChallenge) {
    if (user == null || user.id() == null || user.id().isBlank()) {
      throw new IllegalArgumentException("Desktop handoff user is required");
    }
    if (!isAllowedCodeChallenge(codeChallenge)) {
      throw new IllegalArgumentException("Desktop handoff code challenge is invalid");
    }

    mapper.deleteExpired();
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    mapper.insert(
        new DesktopAuthHandoffRow(
            hash(code),
            user.id(),
            user.displayName(),
            user.email(),
            user.avatarUrl(),
            codeChallenge,
            OffsetDateTime.now(ZoneOffset.UTC).plus(CODE_TTL)));
    return code;
  }

  public DesktopUserPrincipal consume(String code, String codeVerifier) {
    if (code == null || code.isBlank() || !isAllowedCodeVerifier(codeVerifier)) return null;
    DesktopAuthHandoffRow value = mapper.consume(hash(code.trim()));
    if (value == null
        || value.getUserId() == null
        || value.getUserId().isBlank()
        || !matchesCodeChallenge(codeVerifier, value.getCodeChallenge())) return null;
    return new DesktopUserPrincipal(
        value.getUserId(), value.getDisplayName(), value.getEmail(), value.getAvatarUrl());
  }

  @Override
  public AuthenticatedUser consumeUser(String code, String codeVerifier) {
    DesktopUserPrincipal user = consume(code, codeVerifier);
    return user == null
        ? null
        : new AuthenticatedUser(user.id(), user.displayName(), user.email(), user.avatarUrl());
  }

  private static String hash(String value) {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(sha256(value.getBytes(StandardCharsets.UTF_8)));
  }

  private static boolean isAllowedCodeChallenge(String value) {
    return value != null && value.matches(CODE_CHALLENGE_PATTERN);
  }

  private static boolean isAllowedCodeVerifier(String value) {
    return value != null && value.matches(CODE_VERIFIER_PATTERN);
  }

  private static boolean matchesCodeChallenge(String verifier, String expectedChallenge) {
    if (!isAllowedCodeChallenge(expectedChallenge)) return false;
    String actualChallenge =
        Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(sha256(verifier.getBytes(StandardCharsets.US_ASCII)));
    return MessageDigest.isEqual(
        actualChallenge.getBytes(StandardCharsets.US_ASCII),
        expectedChallenge.getBytes(StandardCharsets.US_ASCII));
  }

  private static byte[] sha256(byte[] value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is required for desktop auth handoffs", exception);
    }
  }
}
