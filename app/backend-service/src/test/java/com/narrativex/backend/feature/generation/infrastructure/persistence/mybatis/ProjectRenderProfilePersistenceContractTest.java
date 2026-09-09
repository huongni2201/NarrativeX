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
        Files.readString(
            Path.of("src/main/resources/mybatis/ProjectRenderInputSnapshotMapper.xml"));

    assertTrue(mapper.contains("render_profile_json"));
    assertTrue(mapper.contains("renderProfileJson"));
    assertFalse(mapper.contains("updateFrameRate"));
    assertFalse(mapper.contains("updateSubtitleMode"));
  }

  @Test
  void migrationDefinesCompatibleV2AndV3ProfileBoundary() throws Exception {
    String sql =
        Files.readString(
            Path.of("src/main/resources/db/migration/V16__render_profile_watermark_policy.sql"));

    assertTrue(sql.contains("IN (2, 3)"));
    assertTrue(sql.contains("ck_project_render_profile_v3_watermark"));
    assertTrue(sql.contains("policyVersion"));
  }
}
