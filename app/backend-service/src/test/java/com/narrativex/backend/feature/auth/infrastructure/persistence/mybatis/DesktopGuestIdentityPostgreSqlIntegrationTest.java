package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.auth.application.exception.InvalidDesktopGuestCredentialException;
import com.narrativex.backend.feature.auth.application.port.in.DesktopGuestIdentity;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class DesktopGuestIdentityPostgreSqlIntegrationTest {
  private static final String DEVICE_ID = "00000000-0000-4000-8000-000000000101";
  private static final String OTHER_DEVICE_ID = "00000000-0000-4000-8000-000000000102";
  private static final String SECRET = "s".repeat(43);
  private static final String WRONG_SECRET = "x".repeat(43);

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_guest_identity")
          .withUsername("narrativex")
          .withPassword("narrativex");

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.data.redis.repositories.enabled", () -> false);
  }

  @Autowired private DesktopGuestIdentity desktopGuestIdentity;
  @Autowired private DataSource dataSource;

  @Test
  void installationPersistsAndResumesTheSameGuestWithoutPersistingPlaintextSecret()
      throws Exception {
    String createdGuest = desktopGuestIdentity.establish(DEVICE_ID, SECRET);
    String resumedGuest = desktopGuestIdentity.establish(DEVICE_ID, SECRET);

    assertEquals(createdGuest, resumedGuest);
    assertTrue(createdGuest.startsWith("guest-"));

    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement =
            connection.prepareStatement(
                """
                SELECT installation.guest_user_id,
                       installation.secret_hash,
                       auth.google_subject
                  FROM desktop_guest_installations installation
                  JOIN auth_users auth ON auth.id = installation.guest_user_id
                 WHERE installation.device_id = ?
                """)) {
      statement.setObject(1, UUID.fromString(DEVICE_ID));
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next());
        assertEquals(createdGuest, result.getString("guest_user_id"));
        String secretHash = result.getString("secret_hash");
        assertNotEquals(SECRET, secretHash);
        assertTrue(secretHash.matches("[0-9a-f]{64}"));
        assertNull(result.getString("google_subject"));
      }
    }
  }

  @Test
  void existingInstallationRejectsASecretFromAnotherClient() {
    desktopGuestIdentity.establish(OTHER_DEVICE_ID, SECRET);

    assertThrows(
        InvalidDesktopGuestCredentialException.class,
        () -> desktopGuestIdentity.establish(OTHER_DEVICE_ID, WRONG_SECRET));
  }
}
