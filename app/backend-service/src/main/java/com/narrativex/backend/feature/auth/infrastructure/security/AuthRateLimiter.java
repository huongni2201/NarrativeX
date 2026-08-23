package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.application.exception.AuthRateLimitExceededException;
import com.narrativex.backend.feature.auth.application.port.in.AuthRateLimitPolicy;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class AuthRateLimiter implements AuthRateLimitPolicy {
  private static final int MAX_FALLBACK_BUCKETS = 10_000;
  private static final DefaultRedisScript<Long> INCREMENT_WITH_EXPIRY =
      new DefaultRedisScript<>(
          "local current = redis.call('INCR', KEYS[1]); "
              + "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; "
              + "return current;",
          Long.class);

  private final StringRedisTemplate redisTemplate;
  private final boolean enabled;
  private final int loginIpLimit;
  private final int loginIdentityLimit;
  private final long loginWindowSeconds;
  private final int registerIpLimit;
  private final int registerIdentityLimit;
  private final long registerWindowSeconds;
  private final Map<String, FallbackWindow> fallbackBuckets = new ConcurrentHashMap<>();

  public AuthRateLimiter(
      StringRedisTemplate redisTemplate,
      @Value("${narrativex.security.auth-rate-limit.enabled:true}") boolean enabled,
      @Value("${narrativex.security.auth-rate-limit.login.ip-limit:30}") int loginIpLimit,
      @Value("${narrativex.security.auth-rate-limit.login.identity-limit:10}")
          int loginIdentityLimit,
      @Value("${narrativex.security.auth-rate-limit.login.window-seconds:300}")
          long loginWindowSeconds,
      @Value("${narrativex.security.auth-rate-limit.register.ip-limit:10}") int registerIpLimit,
      @Value("${narrativex.security.auth-rate-limit.register.identity-limit:5}")
          int registerIdentityLimit,
      @Value("${narrativex.security.auth-rate-limit.register.window-seconds:3600}")
          long registerWindowSeconds) {
    this.redisTemplate = redisTemplate;
    this.enabled = enabled;
    this.loginIpLimit = positive(loginIpLimit, "loginIpLimit");
    this.loginIdentityLimit = positive(loginIdentityLimit, "loginIdentityLimit");
    this.loginWindowSeconds = positive(loginWindowSeconds, "loginWindowSeconds");
    this.registerIpLimit = positive(registerIpLimit, "registerIpLimit");
    this.registerIdentityLimit = positive(registerIdentityLimit, "registerIdentityLimit");
    this.registerWindowSeconds = positive(registerWindowSeconds, "registerWindowSeconds");
  }

  @Override
  public void checkLogin(String email, String clientIp) {
    if (!enabled) return;
    consume("login:ip", normalizedIp(clientIp), loginIpLimit, loginWindowSeconds);
    consume("login:identity", normalizedIdentity(email), loginIdentityLimit, loginWindowSeconds);
  }

  @Override
  public void checkRegister(String email, String clientIp) {
    if (!enabled) return;
    consume("register:ip", normalizedIp(clientIp), registerIpLimit, registerWindowSeconds);
    consume(
        "register:identity",
        normalizedIdentity(email),
        registerIdentityLimit,
        registerWindowSeconds);
  }

  private void consume(String bucket, String subject, int limit, long windowSeconds) {
    String key = "narrativex:auth-rate:" + bucket + ":" + sha256(subject);
    try {
      Long count =
          redisTemplate.execute(INCREMENT_WITH_EXPIRY, List.of(key), Long.toString(windowSeconds));
      if (count != null && count > limit) {
        throw new AuthRateLimitExceededException(windowSeconds);
      }
    } catch (AuthRateLimitExceededException exception) {
      throw exception;
    } catch (DataAccessException exception) {
      log.warn("Auth rate limiter unavailable; using bounded in-memory fallback");
      if (consumeFallback(key, limit, windowSeconds)) {
        throw new AuthRateLimitExceededException(windowSeconds);
      }
    }
  }

  private boolean consumeFallback(String key, int limit, long windowSeconds) {
    long now = System.currentTimeMillis();
    // Redis outage is an attackable path. Bound cleanup work per request instead of scanning the
    // entire fallback map (which can otherwise turn a 10k-bucket outage into a CPU DoS).
    int cleaned = 0;
    var iterator = fallbackBuckets.entrySet().iterator();
    while (iterator.hasNext() && cleaned < 64) {
      var entry = iterator.next();
      if (entry.getValue().expiresAtMillis <= now
          && fallbackBuckets.remove(entry.getKey(), entry.getValue())) {
        cleaned++;
      }
    }
    if (!fallbackBuckets.containsKey(key) && fallbackBuckets.size() >= MAX_FALLBACK_BUCKETS) {
      // Capacity exhaustion is handled conservatively: authentication remains available for
      // existing buckets, but unknown subjects are rate-limited until a bucket expires.
      return true;
    }
    FallbackWindow window =
        fallbackBuckets.compute(
            key,
            (ignored, current) -> {
              if (current == null || current.expiresAtMillis <= now) {
                return new FallbackWindow(now + windowSeconds * 1000L, 1);
              }
              current.count++;
              return current;
            });
    return window.count > limit;
  }

  private static final class FallbackWindow {
    private final long expiresAtMillis;
    private int count;

    private FallbackWindow(long expiresAtMillis, int count) {
      this.expiresAtMillis = expiresAtMillis;
      this.count = count;
    }
  }

  private static String normalizedIdentity(String email) {
    return email == null || email.isBlank() ? "unknown" : email.trim().toLowerCase(Locale.ROOT);
  }

  private static String normalizedIp(String clientIp) {
    return clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
  }

  private static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  private static int positive(int value, String name) {
    if (value <= 0) throw new IllegalArgumentException(name + " must be greater than zero");
    return value;
  }

  private static long positive(long value, String name) {
    if (value <= 0) throw new IllegalArgumentException(name + " must be greater than zero");
    return value;
  }
}
