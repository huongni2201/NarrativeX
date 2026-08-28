package com.narrativex.backend.feature.assets.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.api.controller.AssetLibraryController;
import com.narrativex.backend.feature.assets.api.request.RegisterLocalAssetRequest;
import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.assets.application.usecase.AssetLibraryUseCase;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AssetLibraryControllerContractTest {
  private final AssetLibraryUseCase useCase = mock(AssetLibraryUseCase.class);
  private final MediaStorageAccess mediaStorageAccess = mock(MediaStorageAccess.class);
  private final AssetLibraryController controller =
      new AssetLibraryController(useCase, mediaStorageAccess);

  @Test
  void registerLocalReturnsCreatedEnvelopeAndForwardsRequest() {
    UUID assetId = UUID.randomUUID();
    var view =
        new MediaAssetView(
            assetId,
            "IMAGE",
            "LOCAL_ONLY",
            null,
            "scene.png",
            "image/png",
            1024,
            "a".repeat(64),
            null,
            "READY",
            Instant.parse("2026-08-25T00:00:00Z"));
    when(useCase.registerLocal(any(), any(), any(), any(Long.TYPE), any(), any())).thenReturn(view);

    var response =
        controller.registerLocal(
            new RegisterLocalAssetRequest(
                "IMAGE", "scene.png", "image/png", 1024, "a".repeat(64), null));

    assertEquals(HttpStatus.CREATED, response.getStatusCode());
    assertEquals(assetId, response.getBody().data().id());
    assertEquals("LOCAL_ONLY", response.getBody().data().origin());
    verify(useCase).registerLocal("IMAGE", "scene.png", "image/png", 1024, "a".repeat(64), null);
  }
}
