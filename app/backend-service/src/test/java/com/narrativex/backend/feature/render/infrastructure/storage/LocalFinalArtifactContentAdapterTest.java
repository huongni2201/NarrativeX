package com.narrativex.backend.feature.render.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class LocalFinalArtifactContentAdapterTest {
  @Test
  void streamsFullAndPartialRangesFromTheConfiguredRoot() throws Exception {
    Path root = Files.createTempDirectory("narrativex-final-");
    Path artifact = root.resolve("fingerprint.mp4");
    Files.write(artifact, new byte[] {0, 1, 2, 3, 4});
    LocalFinalArtifactContentAdapter adapter = new LocalFinalArtifactContentAdapter(root.toString());

    var full = adapter.read(artifact.toString(), null, null);
    var partial = adapter.read(artifact.toString(), 1L, 3L);

    assertThat(full.content().readAllBytes()).containsExactly(0, 1, 2, 3, 4);
    assertThat(full.partial()).isFalse();
    assertThat(partial.content().readAllBytes()).containsExactly(1, 2, 3);
    assertThat(partial.contentRangeHeader()).isEqualTo("bytes 1-3/5");
  }

  @Test
  void rejectsFilesOutsideTheConfiguredRoot() throws Exception {
    Path root = Files.createTempDirectory("narrativex-final-");
    Path outside = Files.createTempFile("narrativex-outside-", ".mp4");
    LocalFinalArtifactContentAdapter adapter = new LocalFinalArtifactContentAdapter(root.toString());

    assertThatThrownBy(() -> adapter.read(outside.toString(), null, null))
        .isInstanceOf(IllegalStateException.class);
  }
}
