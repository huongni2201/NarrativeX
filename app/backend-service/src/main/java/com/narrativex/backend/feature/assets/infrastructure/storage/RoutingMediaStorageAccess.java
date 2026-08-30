package com.narrativex.backend.feature.assets.infrastructure.storage;

import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import java.net.URI;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/** Routes reusable voice assets to R2 and generated project media to the shared local root. */
@Component
@Primary
@RequiredArgsConstructor
public class RoutingMediaStorageAccess implements MediaStorageAccess {
  private final ObjectStoragePort objectStorage;
  private final ProjectLocalMediaAccess projectLocalMediaAccess;

  @Override
  public URI createDownloadUrl(String storageKey, Instant expiresAt) {
    if (storageKey == null || storageKey.isBlank()) {
      throw new IllegalArgumentException("Media storage key is required");
    }
    if (storageKey.startsWith("voices/")) {
      return objectStorage.createDownload(storageKey, expiresAt).downloadUrl();
    }
    if (projectLocalMediaAccess.supports(storageKey)) {
      return projectLocalMediaAccess.createDownloadUrl(storageKey, expiresAt);
    }
    throw new FeatureNotAvailableException("Unsupported media storage namespace");
  }

  @Override
  public LocalMediaFile resolve(String token) {
    return projectLocalMediaAccess.resolve(token);
  }
}
