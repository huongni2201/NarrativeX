package com.narrativex.backend.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.narrativex.backend.feature.auth.infrastructure.security.NarrativeXOidcUser;
import com.narrativex.backend.feature.auth.infrastructure.security.NarrativeXUserPrincipal;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;

class SessionPrincipalSerializationTest {
  @Test
  void passwordPrincipalIsSerializableWithoutPersistingPasswordHash() {
    NarrativeXUserPrincipal principal =
        new NarrativeXUserPrincipal(
            "user-1",
            "user@example.com",
            "Narrative User",
            null,
            "{bcrypt}$2a$10$not-a-real-hash",
            true);

    principal.eraseCredentials();

    assertThat(principal.getPassword()).isNull();
    assertThatCode(() -> serialize(principal)).doesNotThrowAnyException();
  }

  @Test
  void oidcPrincipalIsSerializableForRedisBackedHttpSession() {
    Instant issuedAt = Instant.now();
    OidcIdToken idToken =
        new OidcIdToken(
            "test-id-token",
            issuedAt,
            issuedAt.plusSeconds(300),
            Map.of("sub", "google-subject", "email", "user@example.com"));
    DefaultOidcUser delegate =
        new DefaultOidcUser(List.of(new SimpleGrantedAuthority("ROLE_USER")), idToken);
    NarrativeXOidcUser principal = new NarrativeXOidcUser("user-1", delegate);

    assertThatCode(() -> serialize(principal)).doesNotThrowAnyException();
  }

  private static byte[] serialize(Object value) throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    try (ObjectOutputStream objectOutput = new ObjectOutputStream(output)) {
      objectOutput.writeObject(value);
    }
    return output.toByteArray();
  }
}
