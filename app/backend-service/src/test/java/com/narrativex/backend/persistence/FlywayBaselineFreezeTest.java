package com.narrativex.backend.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FlywayBaselineFreezeTest {
  private static final Map<String, String> FROZEN_MIGRATIONS =
      Map.of(
          "V1__create_tables.sql", "b535f9f98d8c8950663af3c425840f73d57d1560",
          "V2__init_indexes.sql", "1c5c480858a5643a8db60f13291b3c58dfa630b7",
          "V3__seed_data.sql", "183160e21d911ea51eb8bd784e601ea2155ecc9c");

  @Test
  void appliedBaselineMigrationsRemainImmutable() throws Exception {
    for (Map.Entry<String, String> migration : FROZEN_MIGRATIONS.entrySet()) {
      byte[] bytes = readMigration(migration.getKey());
      assertEquals(
          migration.getValue(),
          gitBlobSha(bytes),
          () ->
              migration.getKey()
                  + " is frozen. Add a new V4+ Flyway migration instead of editing V1-V3."
      );
    }
  }

  private static byte[] readMigration(String filename) throws IOException {
    try (InputStream input =
        FlywayBaselineFreezeTest.class.getResourceAsStream("/db/migration/" + filename)) {
      assertNotNull(input, "Missing Flyway migration: " + filename);
      return input.readAllBytes();
    }
  }

  private static String gitBlobSha(byte[] bytes) throws NoSuchAlgorithmException {
    MessageDigest digest = MessageDigest.getInstance("SHA-1");
    digest.update(("blob " + bytes.length + '\0').getBytes(StandardCharsets.UTF_8));
    digest.update(bytes);
    return HexFormat.of().formatHex(digest.digest());
  }
}
