package com.narrativex.backend.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.api.request.AnalyzeChapterRequest;
import com.narrativex.backend.feature.generation.api.request.CreateProjectRenderRequest;
import com.narrativex.backend.feature.localexecution.application.port.out.LocalProjectRenderStore;
import com.narrativex.backend.support.FlywayMigrationContract;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class DeprecatedRuntimeCleanupTest {

  @Test
  void finalArtifactBaselineDoesNotRetainRemoteFinalVideoFields() throws IOException {
    String v4 = read("V4__narration_notifications_and_artifacts.sql");
    String v7 = read("V7__indexes.sql");
    String finalArtifacts = tableDefinition(v4, "final_artifacts");

    assertThat(finalArtifacts)
        .doesNotContain("storage_provider")
        .doesNotContain("external_file_id")
        .doesNotContain("web_view_link")
        .doesNotContain("DEFAULT 'R2'");
    assertThat(v7).doesNotContain("idx_final_artifacts_external_file_id");
  }

  @Test
  void localRenderCompletionContractContainsOnlyLocalArtifactMetadata() {
    assertThat(
            Arrays.stream(LocalProjectRenderStore.CompletionResult.class.getRecordComponents())
                .map(component -> component.getName())
                .toList())
        .containsExactly(
            "renderFingerprint",
            "storageKey",
            "mimeType",
            "sizeBytes",
            "checksumSha256",
            "durationMs",
            "width",
            "height",
            "fps");
  }

  @Test
  void projectRenderTargetAndCloudCostAreRemoved() throws IOException {
    assertThat(
            Arrays.stream(CreateProjectRenderRequest.class.getRecordComponents())
                .map(component -> component.getName())
                .toList())
        .doesNotContain("executionTarget", "maxAuthorizedCost");

    String v5 = read("V5__catalog_generation_and_render_snapshots.sql");
    assertThat(v5).doesNotContain("execution_target").doesNotContain("'CLOUD'");
  }

  @Test
  void videoAnalysisIntentRemainsSupported() {
    AnalyzeChapterRequest request = new AnalyzeChapterRequest("VIDEO", null);

    assertThat(request.effectiveVisualGenerationMode()).isEqualTo("VIDEO");
    assertThat(request.effectiveImageProvider()).isNull();
  }

  private static String tableDefinition(String migration, String tableName) {
    String startMarker = "CREATE TABLE " + tableName;
    int start = migration.indexOf(startMarker);
    if (start < 0) throw new IllegalArgumentException("Missing table " + tableName);
    int end = migration.indexOf("\n);", start);
    if (end < 0) throw new IllegalArgumentException("Unterminated table " + tableName);
    return migration.substring(start, end + 3);
  }

  private static String read(String name) throws IOException {
    return Files.readString(FlywayMigrationContract.migration(name));
  }
}
