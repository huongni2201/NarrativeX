package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.support.FlywayMigrationContract;
import java.io.IOException;
import java.nio.file.Files;
import org.junit.jupiter.api.Test;

class RenderSnapshotResolutionMigrationTest {
  @Test
  void renderSnapshotAllowsQhd1440p() throws IOException {
    String v5 =
        Files.readString(
            FlywayMigrationContract.migration("V5__catalog_generation_and_render_snapshots.sql"));

    assertTrue(
        v5.contains(
            "CONSTRAINT ck_project_render_input_resolution CHECK (resolution IN ('720p', '1080p', '1440p'))"));
  }
}
