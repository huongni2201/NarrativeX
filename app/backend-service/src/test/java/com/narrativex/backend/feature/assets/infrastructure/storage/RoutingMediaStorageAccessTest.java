package com.narrativex.backend.feature.assets.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.PresignedDownload;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RoutingMediaStorageAccessTest {
  @TempDir Path root;
  @Mock ObjectStoragePort objectStorage;

  @Test
  void routesVoiceReferencesToR2AndNarrationToLocalGateway() throws Exception {
    Instant expiresAt = Instant.now().plusSeconds(300);
    when(objectStorage.createDownload("voices/account-a/reference.wav", expiresAt))
        .thenReturn(
            new PresignedDownload(
                "voices/account-a/reference.wav",
                URI.create("https://r2.example/voice"),
                expiresAt));
    Path audio = root.resolve("narration/request-1/chapter.mp3");
    Files.createDirectories(audio.getParent());
    Files.write(audio, new byte[] {1, 2, 3});
    ProjectLocalMediaAccess local =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");
    RoutingMediaStorageAccess access = new RoutingMediaStorageAccess(objectStorage, local);

    assertThat(access.createDownloadUrl("voices/account-a/reference.wav", expiresAt))
        .isEqualTo(URI.create("https://r2.example/voice"));
    assertThat(access.createDownloadUrl("narration/request-1/chapter.mp3", expiresAt).toString())
        .startsWith("http://localhost:8080/api/v1/local-media/");
    verify(objectStorage).createDownload("voices/account-a/reference.wav", expiresAt);
  }

  @Test
  void resolvesLocalCapabilityTokensThroughTheLocalGateway() throws Exception {
    Instant expiresAt = Instant.now().plusSeconds(300);
    Path audio = root.resolve("narration/request-1/chapter.mp3");
    Files.createDirectories(audio.getParent());
    Files.write(audio, new byte[] {1, 2, 3});
    ProjectLocalMediaAccess local =
        new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080");
    RoutingMediaStorageAccess access = new RoutingMediaStorageAccess(objectStorage, local);

    URI downloadUrl = access.createDownloadUrl("narration/request-1/chapter.mp3", expiresAt);
    String token = downloadUrl.getPath().substring(downloadUrl.getPath().lastIndexOf('/') + 1);

    var resolved = access.resolve(token);

    assertThat(resolved.sizeBytes()).isEqualTo(3L);
    assertThat(resolved.filename()).isEqualTo("chapter.mp3");
  }

  @Test
  void rejectsLegacyGenericR2Namespace() {
    RoutingMediaStorageAccess access =
        new RoutingMediaStorageAccess(
            objectStorage, new ProjectLocalMediaAccess(root.toString(), "http://localhost:8080"));

    assertThatThrownBy(
            () ->
                access.createDownloadUrl(
                    "media/uploads/legacy-object", Instant.now().plusSeconds(300)))
        .isInstanceOf(FeatureNotAvailableException.class);
  }
}
