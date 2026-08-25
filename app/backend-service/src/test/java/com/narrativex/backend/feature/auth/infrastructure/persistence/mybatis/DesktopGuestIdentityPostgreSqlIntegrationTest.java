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
  private static final String TRANSFER_DEVICE_ID = "00000000-0000-4000-8000-000000000103";
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

  @Test
  void ownershipTransferMovesWorkspaceRowsAndDeduplicatesChecksumRegistry() throws Exception {
    String guestUserId = desktopGuestIdentity.establish(TRANSFER_DEVICE_ID, SECRET);
    String targetUserId = "user-google-transfer";
    UUID projectId = UUID.fromString("00000000-0000-7000-8000-000000000201");
    UUID guestAssetId = UUID.fromString("00000000-0000-7000-8000-000000000202");
    UUID targetAssetId = UUID.fromString("00000000-0000-7000-8000-000000000203");
    String checksum = "a".repeat(64);

    try (Connection connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      execute(
          connection,
          "INSERT INTO auth_users (id, email, display_name, enabled) VALUES (?, ?, ?, TRUE)",
          targetUserId,
          "transfer-user@example.invalid",
          "Transfer User");
      execute(
          connection,
          """
          INSERT INTO projects
              (id, name, owner_id, status, source_language, narration_language,
               metadata_language, image_aspect_ratio, image_quality_tier)
          VALUES (?, 'Guest Project', ?, 'DRAFT', 'vi', 'vi', 'vi', '16:9', 'STANDARD')
          """,
          projectId,
          guestUserId);
      execute(
          connection,
          """
          INSERT INTO characters (owner_id, canonical_name, aliases, status)
          VALUES (?, 'Guest Character', '[]'::jsonb, 'ACTIVE')
          """,
          guestUserId);
      execute(
          connection,
          """
          INSERT INTO chapter_creation_idempotency
              (owner_id, project_id, idempotency_key, request_fingerprint)
          VALUES (?, ?, 'guest-create-chapter', ?)
          """,
          guestUserId,
          projectId,
          "b".repeat(64));
      insertLocalAsset(connection, guestAssetId, guestUserId, checksum, "guest.png");
      insertLocalAsset(connection, targetAssetId, targetUserId, checksum, "target.png");
      execute(
          connection,
          "INSERT INTO media_asset_checksums (account_id, sha256, media_asset_id) VALUES (?, ?, ?)",
          guestUserId,
          checksum,
          guestAssetId);
      execute(
          connection,
          "INSERT INTO media_asset_checksums (account_id, sha256, media_asset_id) VALUES (?, ?, ?)",
          targetUserId,
          checksum,
          targetAssetId);
      connection.commit();
    }

    desktopGuestIdentity.transferOwnership(guestUserId, targetUserId);

    try (Connection connection = dataSource.getConnection()) {
      assertEquals(targetUserId, scalarString(connection, "SELECT owner_id FROM projects WHERE id = ?", projectId));
      assertEquals(
          1L,
          scalarLong(
              connection,
              "SELECT COUNT(*) FROM characters WHERE owner_id = ? AND canonical_name = 'Guest Character'",
              targetUserId));
      assertEquals(
          targetUserId,
          scalarString(
              connection,
              "SELECT owner_id FROM chapter_creation_idempotency WHERE project_id = ? AND idempotency_key = 'guest-create-chapter'",
              projectId));
      assertEquals(
          targetUserId,
          scalarString(connection, "SELECT account_id FROM media_assets WHERE id = ?", guestAssetId));
      assertEquals(
          0L,
          scalarLong(
              connection,
              "SELECT COUNT(*) FROM media_asset_checksums WHERE account_id = ? AND sha256 = ?",
              guestUserId,
              checksum));
      assertEquals(
          1L,
          scalarLong(
              connection,
              "SELECT COUNT(*) FROM media_asset_checksums WHERE account_id = ? AND sha256 = ?",
              targetUserId,
              checksum));
      assertEquals(
          guestUserId,
          scalarString(
              connection,
              "SELECT guest_user_id FROM desktop_guest_installations WHERE device_id = ?",
              UUID.fromString(TRANSFER_DEVICE_ID)));
    }
  }

  private static void insertLocalAsset(
      Connection connection, UUID assetId, String accountId, String checksum, String filename)
      throws Exception {
    execute(
        connection,
        """
        INSERT INTO media_assets
            (id, account_id, asset_type, origin, storage_mode, storage_key,
             original_filename, content_type, size_bytes, sha256, status)
        VALUES (?, ?, 'IMAGE', 'LOCAL_ONLY', 'LOCAL_ONLY', NULL, ?, 'image/png', 1, ?, 'READY')
        """,
        assetId,
        accountId,
        filename,
        checksum);
  }

  private static void execute(Connection connection, String sql, Object... values) throws Exception {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
      bind(statement, values);
      assertEquals(1, statement.executeUpdate());
    }
  }

  private static String scalarString(Connection connection, String sql, Object... values)
      throws Exception {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
      bind(statement, values);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next());
        return result.getString(1);
      }
    }
  }

  private static long scalarLong(Connection connection, String sql, Object... values)
      throws Exception {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
      bind(statement, values);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next());
        return result.getLong(1);
      }
    }
  }

  private static void bind(PreparedStatement statement, Object... values) throws Exception {
    for (int index = 0; index < values.length; index++) {
      Object value = values[index];
      if (value instanceof UUID uuid) {
        statement.setObject(index + 1, uuid);
      } else {
        statement.setObject(index + 1, value);
      }
    }
  }
}
