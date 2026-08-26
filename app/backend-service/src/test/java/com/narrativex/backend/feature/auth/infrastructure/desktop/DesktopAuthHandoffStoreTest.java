package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class DesktopAuthHandoffStoreTest {
  private static final String CODE_VERIFIER = "a".repeat(43);
  private final DesktopAuthHandoffMapper mapper = mock(DesktopAuthHandoffMapper.class);
  private DesktopAuthHandoffStore store;

  @BeforeEach
  void setUp() {
    store = new DesktopAuthHandoffStore(mapper);
  }

  @Test
  void issuePersistsOnlyHashedCodeAndConsumeRestoresPrincipal() throws Exception {
    DesktopUserPrincipal principal =
        new DesktopUserPrincipal("user-1", "Narrative User", "user@example.test", "avatar");

    String code = store.issue(principal, challengeFor(CODE_VERIFIER));
    ArgumentCaptor<DesktopAuthHandoffRow> rowCaptor =
        ArgumentCaptor.forClass(DesktopAuthHandoffRow.class);
    verify(mapper).deleteExpired();
    verify(mapper).insert(rowCaptor.capture());
    DesktopAuthHandoffRow stored = rowCaptor.getValue();
    assertNotEquals(code, stored.getCodeHash());
    assertFalse(stored.getCodeHash().contains(code));
    assertEquals(principal.id(), stored.getUserId());
    assertEquals(challengeFor(CODE_VERIFIER), stored.getCodeChallenge());

    when(mapper.consume(anyString())).thenReturn(stored, null);
    assertEquals(principal, store.consume(code, CODE_VERIFIER));
    assertNull(store.consume(code, CODE_VERIFIER));
  }

  @Test
  void wrongVerifierConsumesTheHandoffWithoutAuthenticating() throws Exception {
    DesktopUserPrincipal principal =
        new DesktopUserPrincipal("user-1", "Narrative User", "user@example.test", "avatar");
    String code = store.issue(principal, challengeFor(CODE_VERIFIER));
    ArgumentCaptor<DesktopAuthHandoffRow> rowCaptor =
        ArgumentCaptor.forClass(DesktopAuthHandoffRow.class);
    verify(mapper).insert(rowCaptor.capture());
    when(mapper.consume(anyString())).thenReturn(rowCaptor.getValue(), null);

    assertNull(store.consume(code, "c".repeat(43)));
    assertNull(store.consume(code, CODE_VERIFIER));
  }

  @Test
  void malformedStoredChallengeDoesNotAuthenticate() {
    DesktopAuthHandoffRow row =
        new DesktopAuthHandoffRow(
            "hash", "user-1", "Narrative User", "user@example.test", "avatar", "invalid", null);
    when(mapper.consume(anyString())).thenReturn(row);

    assertNull(store.consume("handoff-code", CODE_VERIFIER));
  }

  private static String challengeFor(String verifier) throws Exception {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(
            MessageDigest.getInstance("SHA-256")
                .digest(verifier.getBytes(StandardCharsets.US_ASCII)));
  }
}
