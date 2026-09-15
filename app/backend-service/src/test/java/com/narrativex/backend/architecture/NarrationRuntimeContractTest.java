package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/** Locks critical narration/outbox baseline contracts used across runtime components. */
class NarrationRuntimeContractTest {
  private static final String ALIGNMENT_VERSION = "whisperx-forced-v1";
  private static final String LEGACY_ALIGNMENT_VERSION = "word-whisper-v1";

  @Test
  void outboxAvailabilityDefaultsToNowForProducersThatOmitIt() throws IOException {
    String migration = resource("db/migration/V3__narration_and_artifacts.sql");

    assertTrue(
        migration.contains(
            "available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP"));
  }

  @Test
  void backendConsumersUseCanonicalWordAlignmentVersion() throws IOException {
    String timeline = resource("mybatis/ProductionTimelineMapper.xml");
    String snapshot = resource("mybatis/ProjectRenderInputSnapshotMapper.xml");

    assertTrue(timeline.contains("nal.alignment_version = '" + ALIGNMENT_VERSION + "'"));
    assertTrue(snapshot.contains("nal.alignment_version = '" + ALIGNMENT_VERSION + "'"));
    assertFalse(timeline.contains(LEGACY_ALIGNMENT_VERSION));
    assertFalse(snapshot.contains(LEGACY_ALIGNMENT_VERSION));
  }

  private static String resource(String path) throws IOException {
    ClassLoader loader = NarrationRuntimeContractTest.class.getClassLoader();
    try (InputStream stream = loader.getResourceAsStream(path)) {
      if (stream == null) {
        throw new IOException("Missing classpath resource: " + path);
      }
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
