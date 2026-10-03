package com.narrativex.backend.feature.generation.infrastructure.compute;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class LtxWorkerContractTest {
  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void backendDefaultsMustMatchWorkerManifestExactRuntimeIdentity() throws IOException {
    VideoGenerationProperties properties = new VideoGenerationProperties();

    // Locate worker manifest
    File manifestFile = findManifestFile();
    assertNotNull(manifestFile, "native-av.manifest.json must exist in the repository");
    assertTrue(manifestFile.exists(), "Manifest file must exist: " + manifestFile.getAbsolutePath());

    JsonNode manifest = mapper.readTree(manifestFile);

    // Exact runtime identity match
    assertEquals("ltx", properties.getDefaultProvider(), "Default provider must be ltx");
    assertEquals(
        manifest.path("modelId").asText(),
        properties.getDefaultModel(),
        "Backend default model must exactly match worker manifest modelId");
    assertEquals(
        manifest.path("modelRevision").asText(),
        properties.getModelRevision(),
        "Backend model revision must exactly match worker manifest modelRevision");
    assertEquals(
        manifest.path("profileId").asText(),
        properties.getDefaultProfile(),
        "Backend default profile must exactly match worker manifest profileId");
    assertEquals(
        "video.generate:1.1",
        properties.getWorkflowRevision(),
        "Backend workflow revision must be video.generate:1.1");

    // Capabilities consistency
    assertTrue(
        manifest.path("capabilities").path("t2v").asBoolean(),
        "Manifest must support text-to-video");
    assertTrue(
        properties.getSupportedStrategies().contains(GenerationStrategy.TEXT_TO_VIDEO),
        "Backend catalog must support TEXT_TO_VIDEO");
  }

  private File findManifestFile() {
    Path[] candidates = new Path[] {
      Path.of("../../app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/workflows/native-av.manifest.json"),
      Path.of("../generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/workflows/native-av.manifest.json"),
      Path.of("app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/workflows/native-av.manifest.json")
    };
    for (Path candidate : candidates) {
      File f = candidate.toFile();
      if (f.exists()) {
        return f;
      }
    }
    // Search upwards
    File current = new File(".").getAbsoluteFile();
    while (current != null) {
      File candidate = new File(
          current,
          "app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/workflows/native-av.manifest.json");
      if (candidate.exists()) {
        return candidate;
      }
      current = current.getParentFile();
    }
    return null;
  }
}
