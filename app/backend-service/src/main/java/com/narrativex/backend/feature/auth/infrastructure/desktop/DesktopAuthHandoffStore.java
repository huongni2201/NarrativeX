package com.narrativex.backend.feature.auth.infrastructure.desktop;

import com.narrativex.backend.feature.auth.application.port.in.DesktopAuthHandoff;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * Redis-backed, single-use desktop OAuth handoff codes. Raw codes are never persisted or logged.
 */
@Component
@RequiredArgsConstructor
public class DesktopAuthHandoffStore implements DesktopAuthHandoff {
  private static final Duration CODE_TTL = Duration.ofSeconds(90);
  private static final String KEY_PREFIX = "narrativex:auth:desktop-handoff:";
  private static final String CODE_CHALLENGE_PATTERN = "[A-Za-z0-9_-]{43}";
  private static final String CODE_VERIFIER_PATTERN = "[A-Za-z0-9_-]{43,86}";

  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;
  private final SecureRandom secureRandom = new SecureRandom();

  public String issue(DesktopUserPrincipal user, String codeChallenge) {
    if (user == null || user.id() == null || user.id().isBlank()) {
      throw new IllegalArgumentException("Desktop handoff user is required");
    }
    if (!isAllowedCodeChallenge(codeChallenge)) {
      throw new IllegalArgumentException("Desktop handoff code challenge is invalid");
    }

    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    redisTemplate
        .opsForValue()
        .set(
            redisKey(code),
            writePayload(
                new HandoffPayload(
                    user.id(), user.displayName(), user.email(), user.avatarUrl(), codeChallenge)),
            CODE_TTL);
    return code;
  }

  public DesktopUserPrincipal consume(String code, String codeVerifier) {
    if (code == null || code.isBlank() || !isAllowedCodeVerifier(codeVerifier)) return null;
    String payload = redisTemplate.opsForValue().getAndDelete(redisKey(code.trim()));
    if (payload == null || payload.isBlank()) return null;

    try {
      HandoffPayload value = objectMapper.readValue(payload, HandoffPayload.class);
      if (value.id() == null
          || value.id().isBlank()
          || !matchesCodeChallenge(codeVerifier, value.codeChallenge())) return null;
      return new DesktopUserPrincipal(
          value.id(), value.displayName(), value.email(), value.avatarUrl());
    } catch (JacksonException exception) {
      throw new IllegalStateException("Stored desktop auth handoff is invalid", exception);
    }
  }

  @Override
  public AuthenticatedUser consumeUser(String code, String codeVerifier) {
    DesktopUserPrincipal user = consume(code, codeVerifier);
    return user == null
        ? null
        : new AuthenticatedUser(user.id(), user.displayName(), user.email(), user.avatarUrl());
  }

  private String writePayload(HandoffPayload payload) {
    try {
      return objectMapper.writeValueAsString(payload);
    } catch (JacksonException exception) {
      throw new IllegalStateException("Desktop auth handoff could not be serialized", exception);
    }
  }

  private static String redisKey(String code) {
    return KEY_PREFIX + hash(code);
  }

  private static String hash(String value) {
    try {
      return Base64.getUrlEncoder()
          .withoutPadding()
          .encodeToString(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is required for desktop auth handoffs", exception);
    }
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

  private record HandoffPayload(
      String id, String displayName, String email, String avatarUrl, String codeChallenge) {}
}
