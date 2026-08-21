package com.narrativex.backend.feature.auth.infrastructure.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import com.narrativex.backend.feature.auth.application.exception.AuthRateLimitExceededException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

@ExtendWith(MockitoExtension.class)
class AuthRateLimiterTest {
  @Mock private StringRedisTemplate redisTemplate;

  @Test
  @SuppressWarnings({"rawtypes", "unchecked"})
  void identityBucketIsStableAcrossDifferentClientIps() {
    doReturn(1L)
        .when(redisTemplate)
        .execute(any(DefaultRedisScript.class), anyList(), any(String.class));

    AuthRateLimiter limiter = new AuthRateLimiter(redisTemplate, true, 30, 10, 300, 10, 5, 3600);

    limiter.checkLogin("User@Example.com", "10.0.0.1");
    limiter.checkLogin(" user@example.com ", "10.0.0.2");

    ArgumentCaptor<List<String>> keys = ArgumentCaptor.forClass(List.class);
    verify(redisTemplate, org.mockito.Mockito.times(4))
        .execute(any(DefaultRedisScript.class), keys.capture(), any(String.class));

    List<List<String>> captured = keys.getAllValues();
    String firstIpKey = captured.get(0).getFirst();
    String firstIdentityKey = captured.get(1).getFirst();
    String secondIpKey = captured.get(2).getFirst();
    String secondIdentityKey = captured.get(3).getFirst();

    assertNotEquals(firstIpKey, secondIpKey);
    assertEquals(firstIdentityKey, secondIdentityKey);
  }

  @Test
  @SuppressWarnings({"rawtypes", "unchecked"})
  void redisFailureUsesBoundedFallbackInsteadOfAllowingUnlimitedRequests() {
    doThrow(new DataAccessResourceFailureException("redis unavailable"))
        .when(redisTemplate)
        .execute(any(DefaultRedisScript.class), anyList(), any(String.class));

    AuthRateLimiter limiter = new AuthRateLimiter(redisTemplate, true, 30, 1, 300, 10, 5, 3600);

    limiter.checkLogin("user@example.com", "10.0.0.1");

    assertThrows(
        AuthRateLimitExceededException.class,
        () -> limiter.checkLogin("user@example.com", "10.0.0.1"));
  }
}
