package com.narrativex.backend.feature.assets.application.port.out;

import java.net.URI;
import java.time.Instant;
import java.util.Map;

/** Provider-neutral boundary for private object storage. */
public interface ObjectStoragePort {
  PresignedUpload createUpload(CreateUpload command);

  StoredObject head(String storageKey);

  void delete(String storageKey);

  record CreateUpload(
      String storageKey,
      String contentType,
      long contentLength,
      String checksumSha256,
      Instant expiresAt) {}

  record PresignedUpload(
      String storageKey, URI uploadUrl, Instant expiresAt, Map<String, String> requiredHeaders) {
    public PresignedUpload(String storageKey, URI uploadUrl, Instant expiresAt) {
      this(storageKey, uploadUrl, expiresAt, Map.of());
    }
  }

  record StoredObject(String storageKey, long sizeBytes, String contentType, String sha256) {}

  class ObjectNotFoundException extends RuntimeException {
    public ObjectNotFoundException(String storageKey) {
      super("Object was not found: " + storageKey);
    }
  }
}
