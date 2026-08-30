package com.narrativex.backend.feature.assets.application.port.in;

import java.net.URI;
import java.time.Instant;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;

public interface MediaStorageAccess {
  URI createDownloadUrl(String storageKey, Instant expiresAt);

  default LocalMediaFile resolve(String token) {
    throw new UnsupportedOperationException("This media storage does not expose local capability tokens");
  }

  record LocalMediaFile(
      Resource resource, MediaType contentType, long sizeBytes, String filename) {}
}
