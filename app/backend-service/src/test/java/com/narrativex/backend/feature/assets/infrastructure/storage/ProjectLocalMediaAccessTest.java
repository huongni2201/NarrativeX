package com.narrativex.backend.feature.assets.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ProjectLocalMediaAccessTest {
  @TempDir Path root;

  @Test
  void createsShortLivedCapabilityForNarrationAndResolvesSameLocalFile() throws Exception {
    Path audio = root.resolve("narration/request-1/chapter.mp3");
    Files.createDirectories(audio.getParent());
    Files.write(audio, new byte[] {1, 2, 3, 4});
    ProjectLocalMediaAccess access =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");

    var url =
        access.createDownloadUrl(
            "narration/request-1/chapter.mp3", Instant.now().plusSeconds(60));
    String token = url.getPath().substring(url.getPath().lastIndexOf('/') + 1);
    var resolved = access.resolve(token);

    assertThat(url.toString()).startsWith("http://localhost:8080/api/v1/local-media/");
    assertThat(resolved.resource().getFile()).isEqualTo(audio.toFile());
    assertThat(resolved.contentType().toString()).isEqualTo("audio/mpeg");
    assertThat(resolved.sizeBytes()).isEqualTo(4);
  }

  @Test
  void rejectsUnknownAndTraversalNamespaces() {
    ProjectLocalMediaAccess access =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");

    assertThat(access.supports("voices/account-a/reference.wav")).isFalse();
    assertThat(access.supports("media/uploads/legacy-object")).isFalse();
    assertThatThrownBy(
            () ->
                access.createDownloadUrl(
                    "narration/../../secret.mp3", Instant.now().plusSeconds(60)))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
