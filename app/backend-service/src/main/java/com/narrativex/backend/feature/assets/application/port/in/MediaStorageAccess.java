package com.narrativex.backend.feature.assets.application.port.in;

import java.net.URI;
import java.time.Instant;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;

public interface MediaStorageAccess {
  URI createDownloadUrl(String storageKey, Instant expiresAt);

  LocalMediaFile resolve(String token);

  record LocalMediaFile(
      Resource resource, MediaType contentType, long sizeBytes, String filename) {}
}
