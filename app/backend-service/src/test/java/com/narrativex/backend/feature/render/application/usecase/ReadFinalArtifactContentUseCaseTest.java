package com.narrativex.backend.feature.render.application.usecase;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactContentPort;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReadFinalArtifactContentUseCaseTest {
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID CHAPTER_ID = UuidV7.random();

  private final FinalArtifactContentPort contentPort = mock(FinalArtifactContentPort.class);
  private final ReadFinalArtifactContentUseCase useCase =
      new ReadFinalArtifactContentUseCase(contentPort);

  @Test
  void refusesContentBeforeArtifactIsReady() {
    var artifact = artifact("PENDING", "drive-file");

    assertThatThrownBy(() -> useCase.execute(artifact, null, null))
        .isInstanceOf(FeatureNotAvailableException.class);
    verifyNoInteractions(contentPort);
  }

  @Test
  void refusesContentWithoutExternalProviderIdentity() {
    var artifact = artifact("READY", null);

    assertThatThrownBy(() -> useCase.execute(artifact, null, null))
        .isInstanceOf(FeatureNotAvailableException.class);
    verifyNoInteractions(contentPort);
  }

  private static FinalArtifactView artifact(String status, String externalFileId) {
    return new FinalArtifactView(
        1L,
        PROJECT_ID,
        CHAPTER_ID,
        "CHAPTER_VIDEO",
        "fingerprint",
        "storage-key",
        "GOOGLE_DRIVE",
        externalFileId,
        null,
        "video/mp4",
        100L,
        "checksum",
        1000L,
        1920,
        1080,
        status,
        Instant.EPOCH,
        Instant.EPOCH);
  }
}
