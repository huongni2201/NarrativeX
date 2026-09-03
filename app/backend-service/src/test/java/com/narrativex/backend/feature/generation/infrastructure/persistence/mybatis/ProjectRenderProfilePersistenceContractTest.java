package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ProjectRenderProfilePersistenceContractTest {

  @Test
  void snapshotHeaderPersistsRenderProfileAtomically() throws Exception {
    String mapper =
        Files.readString(Path.of("src/main/resources/mybatis/ProjectRenderInputSnapshotMapper.xml"));

    assertTrue(mapper.contains("render_profile_json"));
    assertTrue(mapper.contains("renderProfileJson"));
    assertFalse(mapper.contains("updateFrameRate"));
    assertFalse(mapper.contains("updateSubtitleMode"));
  }

  @Test
  void migrationPermitsLegacyAndV2ProfilesWithoutRewritingHistory() throws Exception {
    Path migration = Path.of("src/main/resources/db/migration/V9__render_profile_v2.sql");
    assertTrue(Files.exists(migration), "V9 migration must introduce profile v2 compatibility");

    String sql = Files.readString(migration);
    assertTrue(sql.contains("ck_project_render_profile_version"));
    assertTrue(sql.matches("(?s).*schemaVersion.*IN\\s*\\(1,\\s*2\\).*"));
    assertFalse(sql.matches("(?s).*UPDATE\\s+project_render_input_snapshots.*"));
  }
}
