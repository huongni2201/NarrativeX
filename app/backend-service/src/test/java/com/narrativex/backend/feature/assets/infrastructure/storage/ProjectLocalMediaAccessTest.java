package com.narrativex.backend.feature.assets.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
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
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080/");

    var url =
        access.createDownloadUrl("narration/request-1/chapter.mp3", Instant.now().plusSeconds(60));
    String token = token(url.getPath());
    var resolved = access.resolve(token);

    assertThat(url.toString()).startsWith("http://localhost:8080/api/v1/local-media/");
    assertThat(resolved.resource().getFile()).isEqualTo(audio.toFile());
    assertThat(resolved.contentType().toString()).isEqualTo("audio/mpeg");
    assertThat(resolved.sizeBytes()).isEqualTo(4);
    assertThat(resolved.filename()).isEqualTo("chapter.mp3");
  }

  @Test
  void createsCapabilityForWorkerProjectScopedNarration() throws Exception {
    String storageKey =
        "projects/01a04feb-9dd7-7271-9242-f7920cbf266a/assets/audio/chapter-ce4efdda466d2974.mp3";
    Path audio = root.resolve(storageKey);
    Files.createDirectories(audio.getParent());
    Files.write(audio, new byte[] {1, 2, 3, 4});
    ProjectLocalMediaAccess access =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");

    assertThat(access.supports("projects/not-a-project/assets/audio/chapter.mp3")).isFalse();
    var url = access.createDownloadUrl(storageKey, Instant.now().plusSeconds(60));
    var resolved = access.resolve(token(url.getPath()));

    assertThat(resolved.resource().getFile()).isEqualTo(audio.toFile());
    assertThat(resolved.contentType().toString()).isEqualTo("audio/mpeg");
  }

  @Test
  void rejectsProjectAssetKeyThatEscapesItsAssetsDirectory() throws Exception {
    String projectId = "01a04feb-9dd7-7271-9242-f7920cbf266a";
    Path manifest = root.resolve("projects/" + projectId + "/project.manifest.json");
    Files.createDirectories(manifest.getParent());
    Files.writeString(manifest, "{}");
    ProjectLocalMediaAccess access =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");

    assertThatThrownBy(
            () ->
                access.createDownloadUrl(
                    "projects/" + projectId + "/assets/audio/../../project.manifest.json",
                    Instant.now().plusSeconds(60)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported");
  }

  @Test
  void defaultsBlankPublicBaseUrlAndSupportsProviderResults() throws Exception {
    Path image = root.resolve("private/provider-results/job-1/frame.png");
    Files.createDirectories(image.getParent());
    Files.write(image, new byte[] {1});
    ProjectLocalMediaAccess access = new ProjectLocalMediaAccess(root.toString(), "   ");

    assertThat(access.supports(null)).isFalse();
    assertThat(access.supports("private/provider-results/job-1/frame.png")).isTrue();
    assertThat(
            access
                .createDownloadUrl(
                    "private/provider-results/job-1/frame.png", Instant.now().plusSeconds(60))
                .toString())
        .startsWith("http://localhost:8080/api/v1/local-media/");
  }

  @Test
  void rejectsUnsupportedMissingExpiredAndUnknownCapabilities() {
    ProjectLocalMediaAccess access =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");

    assertThat(access.supports("voices/account-a/reference.wav")).isFalse();
    assertThat(access.supports("media/uploads/legacy-object")).isFalse();
    assertThatThrownBy(
            () ->
                access.createDownloadUrl(
                    "voices/account-a/reference.wav", Instant.now().plusSeconds(60)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported");
    assertThatThrownBy(
            () -> access.createDownloadUrl("narration/missing.mp3", Instant.now().plusSeconds(60)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("unavailable");
    assertThatThrownBy(() -> access.createDownloadUrl("narration/missing.mp3", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("expire in the future");
    assertThatThrownBy(
            () -> access.createDownloadUrl("narration/missing.mp3", Instant.now().minusSeconds(1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("expire in the future");
    assertThatThrownBy(() -> access.resolve("not-a-ticket"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown local media token");
    assertThatThrownBy(
            () ->
                access.createDownloadUrl(
                    "narration/../../secret.mp3", Instant.now().plusSeconds(60)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsCapabilityWhenItsFileDisappearsBeforeResolution() throws Exception {
    Path audio = root.resolve("narration/request-2/chapter.wav");
    Files.createDirectories(audio.getParent());
    Files.write(audio, new byte[] {1, 2});
    ProjectLocalMediaAccess access =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");
    var url =
        access.createDownloadUrl("narration/request-2/chapter.wav", Instant.now().plusSeconds(60));
    Files.delete(audio);

    assertThatThrownBy(() -> access.resolve(token(url.getPath())))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("unavailable");
  }

  @Test
  void reportsKnownMediaTypesForLocalProjectFiles() throws Exception {
    Map<String, String> expectedTypes =
        Map.of(
            "sample.wav", "audio/wav",
            "frame.png", "image/png",
            "photo.jpg", "image/jpeg",
            "photo.jpeg", "image/jpeg",
            "frame.webp", "image/webp",
            "clip.mp4", "video/mp4");
    ProjectLocalMediaAccess access =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");

    for (var entry : expectedTypes.entrySet()) {
      String storageKey = "private/provider-results/types/" + entry.getKey();
      Path path = root.resolve(storageKey);
      Files.createDirectories(path.getParent());
      Files.write(path, new byte[] {1});
      var url = access.createDownloadUrl(storageKey, Instant.now().plusSeconds(60));

      assertThat(access.resolve(token(url.getPath())).contentType().toString())
          .isEqualTo(entry.getValue());
    }
  }

  private static String token(String path) {
    return path.substring(path.lastIndexOf('/') + 1);
  }
}
