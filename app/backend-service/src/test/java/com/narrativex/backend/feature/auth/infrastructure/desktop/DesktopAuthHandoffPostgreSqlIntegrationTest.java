package com.narrativex.backend.feature.auth.infrastructure.desktop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class DesktopAuthHandoffPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final String VERIFIER = "a".repeat(43);

  @Autowired private DesktopAuthHandoffMapper mapper;

  @Test
  void postgresStoreRoundTripsAndAtomicallyConsumesHandoff() throws Exception {
    DesktopAuthHandoffStore store = new DesktopAuthHandoffStore(mapper);
    DesktopUserPrincipal principal =
        new DesktopUserPrincipal("user-postgres-1", "Narrative User", "user@example.test", null);

    String code = store.issue(principal, challengeFor(VERIFIER));
    assertNotNull(code);
    assertEquals(principal, store.consume(code, VERIFIER));
    assertNull(store.consume(code, VERIFIER));
  }

  @Test
  void wrongVerifierStillBurnsTheOneTimeCode() throws Exception {
    DesktopAuthHandoffStore store = new DesktopAuthHandoffStore(mapper);
    DesktopUserPrincipal principal =
        new DesktopUserPrincipal("user-postgres-2", "Narrative User", "user2@example.test", null);

    String code = store.issue(principal, challengeFor(VERIFIER));
    assertNull(store.consume(code, "c".repeat(43)));
    assertNull(store.consume(code, VERIFIER));
  }

  private static String challengeFor(String verifier) throws Exception {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(
            MessageDigest.getInstance("SHA-256")
                .digest(verifier.getBytes(StandardCharsets.US_ASCII)));
  }
}
