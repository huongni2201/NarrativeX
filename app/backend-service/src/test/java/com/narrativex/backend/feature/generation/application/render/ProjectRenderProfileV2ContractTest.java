package com.narrativex.backend.feature.generation.application.render;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ProjectRenderProfileV2ContractTest {

  @Test
  void renderProfileFactoryDefinesVersionedHighQualityDefaults() throws Exception {
    Path path =
        Path.of(
            "src/main/java/com/narrativex/backend/feature/generation/application/render/ProjectRenderProfileFactory.java");
    assertTrue(Files.exists(path), "ProjectRenderProfileFactory must own the immutable v2 profile");

    String source = Files.readString(path);
    assertTrue(source.contains("schemaVersion"));
    assertTrue(source.contains("project-image-motion-v3-composition"));
    assertTrue(source.contains("compositionPolicyVersion"));
    assertTrue(source.contains("medium"));
    assertTrue(source.contains("18"));
    assertTrue(source.contains("p6"));
    assertTrue(source.contains("19"));
    assertTrue(source.contains("yuv420p"));
    assertTrue(source.contains("SDR_BT709_LIMITED"));
    assertTrue(source.contains("burn_in"));
    assertTrue(source.contains("none"));
  }
}
