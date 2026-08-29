package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ProductionBeatMediaSelectionScopeContractTest {
  private static final Path SELECTION_MAPPER =
      Path.of("src/main/resources/mybatis/ProductionBeatMediaSelectionMapper.xml");
  private static final Path FINAL_SCHEMA =
      Path.of("src/main/resources/db/migration/V6__database_logic_and_triggers.sql");

  @Test
  void projectMediaUsesDirectProjectOwnershipWithoutStorageMode() throws IOException {
    String mapper = Files.readString(SELECTION_MAPPER);
    String schema = Files.readString(FINAL_SCHEMA);

    assertTrue(mapper.contains("ma.project_id = #{projectId"));
    assertFalse(mapper.contains("local_media_materializations"));
    assertFalse(mapper.contains("storage_mode"));
    assertTrue(schema.contains("ALTER TABLE media_assets ALTER COLUMN project_id SET NOT NULL"));
    assertTrue(schema.contains("ALTER TABLE media_assets DROP COLUMN storage_mode"));
    assertTrue(schema.contains("DROP TABLE IF EXISTS local_media_materializations"));
    assertTrue(schema.contains("CREATE TABLE voice_reference_assets"));
  }
}
