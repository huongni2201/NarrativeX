package com.narrativex.backend.feature.auth.infrastructure.desktop;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** In-memory, single-use handoff codes. The code is never persisted or logged. */
@Component
public class DesktopAuthHandoffStore {
  private static final Duration CODE_TTL = Duration.ofSeconds(90);
  private final SecureRandom secureRandom = new SecureRandom();
  private final Clock clock = Clock.systemUTC();
  private final Map<String, Handoff> handoffs = new ConcurrentHashMap<>();

  public String issue(String userId) {
    purgeExpired();
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    handoffs.put(hash(code), new Handoff(userId, Instant.now(clock).plus(CODE_TTL)));
    return code;
  }

  public String consume(String code) {
    if (code == null || code.isBlank()) return null;
    Handoff handoff = handoffs.remove(hash(code.trim()));
    if (handoff == null || handoff.expiresAt().isBefore(Instant.now(clock))) return null;
    return handoff.userId();
  }

  private void purgeExpired() {
    Instant now = Instant.now(clock);
    handoffs.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
  }

  private static String hash(String value) {
    try {
      return Base64.getUrlEncoder()
          .withoutPadding()
          .encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is required for desktop auth handoffs", exception);
    }
  }

  private record Handoff(String userId, Instant expiresAt) {}
}
