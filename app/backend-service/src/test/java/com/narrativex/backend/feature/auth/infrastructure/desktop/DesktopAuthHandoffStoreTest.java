package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
  private static final String CODE_VERIFIER = "a".repeat(43);
  private static final String CODE_CHALLENGE = "b".repeat(43);
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
  void issueSerializesPayloadAndConsumeRestoresPrincipal() throws Exception {
    DesktopUserPrincipal principal =
        new DesktopUserPrincipal("user-1", "Narrative User", "user@example.test", "avatar");

    String code = store.issue(principal, CODE_CHALLENGE);
    var payloadCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(valueOperations)
        .set(
            anyString(),
            payloadCaptor.capture(),
            org.mockito.ArgumentMatchers.eq(Duration.ofSeconds(90)));
    assertEquals(
        true, payloadCaptor.getValue().contains("\"codeChallenge\":\"" + CODE_CHALLENGE + "\""));
    assertEquals(false, payloadCaptor.getValue().contains("codeVerifier"));
    when(valueOperations.getAndDelete(anyString())).thenReturn(payloadCaptor.getValue());

    // The stored challenge must match the verifier, so use a payload generated from the verifier.
    String matchingChallenge =
        java.util.Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(
                java.security.MessageDigest.getInstance("SHA-256")
                    .digest(CODE_VERIFIER.getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
    String matchingPayload = payloadCaptor.getValue().replace(CODE_CHALLENGE, matchingChallenge);
    when(valueOperations.getAndDelete(anyString())).thenReturn(matchingPayload, null);
    assertEquals(principal, store.consume(code, CODE_VERIFIER));
    assertNull(store.consume(code, CODE_VERIFIER));
  }

  @Test
  void wrongVerifierConsumesTheHandoffWithoutAuthenticating() throws Exception {
    DesktopUserPrincipal principal =
        new DesktopUserPrincipal("user-1", "Narrative User", "user@example.test", "avatar");
    String code = store.issue(principal, challengeFor(CODE_VERIFIER));
    var payloadCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(valueOperations)
        .set(
            anyString(),
            payloadCaptor.capture(),
            org.mockito.ArgumentMatchers.eq(Duration.ofSeconds(90)));
    when(valueOperations.getAndDelete(anyString())).thenReturn(payloadCaptor.getValue(), null);

    assertNull(store.consume(code, "c".repeat(43)));
    assertNull(store.consume(code, CODE_VERIFIER));
  }

  @Test
  void invalidStoredPayloadFailsWithContractError() {
    when(valueOperations.getAndDelete(anyString())).thenReturn("not-json");

    assertThrows(IllegalStateException.class, () -> store.consume("handoff-code", CODE_VERIFIER));
  }

  private static String challengeFor(String verifier) throws Exception {
    return java.util.Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(
            java.security.MessageDigest.getInstance("SHA-256")
                .digest(verifier.getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
  }
}
