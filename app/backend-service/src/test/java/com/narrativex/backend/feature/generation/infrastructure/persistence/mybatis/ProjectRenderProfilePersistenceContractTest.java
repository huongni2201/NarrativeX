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
  void preReleaseBaselineDefinesRenderProfileV2() throws Exception {
    String sql =
        Files.readString(
            Path.of(
                "src/main/resources/db/migration/V5__catalog_generation_and_render_snapshots.sql"));

    assertTrue(sql.contains("\"schemaVersion\": 2"));
    assertTrue(sql.contains("\"rendererVersion\": \"project-image-motion-v3-composition\""));
    assertTrue(sql.contains("\"compositionPolicyVersion\": 1"));
    assertTrue(
        sql.matches(
            "(?s).*ck_project_render_profile_version.*schemaVersion.*=\\s*2.*"),
        "The pre-release baseline must admit only the current render-profile schema");
  }
}
