package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ProductionBeatMediaSelectionScopeContractTest {
  private static final Path MEDIA_SCHEMA =
      Path.of("src/main/resources/db/migration/V3__generation_billing_and_media.sql");
  private static final Path SELECTION_MAPPER =
      Path.of("src/main/resources/mybatis/ProductionBeatMediaSelectionMapper.xml");

  @Test
  void projectMediaUsesDirectProjectOwnershipWithoutStorageMode() throws IOException {
    String mapper = Files.readString(SELECTION_MAPPER);
    String schema = Files.readString(MEDIA_SCHEMA);

    assertTrue(mapper.contains("ma.project_id = #{projectId"));
    assertFalse(mapper.contains("local_media_materializations"));
    assertFalse(mapper.contains("storage_mode"));

    assertTrue(schema.contains("project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE"));
    assertTrue(schema.contains("CREATE TABLE voice_reference_assets"));
    assertFalse(schema.contains("storage_mode"));
    assertFalse(schema.contains("local_media_materializations"));
    assertFalse(schema.contains("media_asset_checksums"));
  }
}
