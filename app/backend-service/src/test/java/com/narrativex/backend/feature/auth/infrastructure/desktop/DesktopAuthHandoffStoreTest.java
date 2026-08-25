package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.ObjectMapper;

class DesktopAuthHandoffStoreTest {
  private final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
  private final ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
  private final ObjectMapper objectMapper = new ObjectMapper();
  private DesktopAuthHandoffStore store;

  @BeforeEach
  void setUp() {
    when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    store = new DesktopAuthHandoffStore(redisTemplate, objectMapper);
  }

  @Test
  void issueSerializesPayloadAndConsumeRestoresPrincipal() {
    DesktopUserPrincipal principal =
        new DesktopUserPrincipal("user-1", "Narrative User", "user@example.test", "avatar");

    String code = store.issue(principal);
    var payloadCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(valueOperations)
        .set(
            anyString(),
            payloadCaptor.capture(),
            org.mockito.ArgumentMatchers.eq(Duration.ofSeconds(90)));
    when(valueOperations.getAndDelete(anyString())).thenReturn(payloadCaptor.getValue());

    assertEquals(principal, store.consume(code));
  }

  @Test
  void invalidStoredPayloadFailsWithContractError() {
    when(valueOperations.getAndDelete(anyString())).thenReturn("not-json");

    assertThrows(IllegalStateException.class, () -> store.consume("handoff-code"));
  }
}
