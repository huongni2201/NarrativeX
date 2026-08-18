package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.application.exception.AuthRateLimitExceededException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class AuthRateLimiter {
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

  public AuthRateLimiter(
      StringRedisTemplate redisTemplate,
      @Value("${narrativex.security.auth-rate-limit.enabled:true}") boolean enabled,
      @Value("${narrativex.security.auth-rate-limit.login.ip-limit:30}") int loginIpLimit,
      @Value("${narrativex.security.auth-rate-limit.login.identity-limit:10}") int loginIdentityLimit,
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

  public void checkLogin(String email, String clientIp) {
    if (!enabled) return;
    consume("login:ip", clientIp, loginIpLimit, loginWindowSeconds);
    consume(
        "login:identity",
        normalizedIdentity(email, clientIp),
        loginIdentityLimit,
        loginWindowSeconds);
  }

  public void checkRegister(String email, String clientIp) {
    if (!enabled) return;
    consume("register:ip", clientIp, registerIpLimit, registerWindowSeconds);
    consume(
        "register:identity",
        normalizedIdentity(email, clientIp),
        registerIdentityLimit,
        registerWindowSeconds);
  }

  private void consume(String bucket, String subject, int limit, long windowSeconds) {
    String key = "narrativex:auth-rate:" + bucket + ":" + sha256(subject == null ? "unknown" : subject);
    try {
      Long count =
          redisTemplate.execute(
              INCREMENT_WITH_EXPIRY, List.of(key), Long.toString(windowSeconds));
      if (count != null && count > limit) {
        throw new AuthRateLimitExceededException(windowSeconds);
      }
    } catch (AuthRateLimitExceededException exception) {
      throw exception;
    } catch (DataAccessException exception) {
      log.warn("Auth rate limiter unavailable; allowing request to preserve authentication availability", exception);
    }
  }

  private static String normalizedIdentity(String email, String clientIp) {
    String normalizedEmail = email == null ? "unknown" : email.trim().toLowerCase();
    String normalizedIp = clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
    return normalizedEmail + "|" + normalizedIp;
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
