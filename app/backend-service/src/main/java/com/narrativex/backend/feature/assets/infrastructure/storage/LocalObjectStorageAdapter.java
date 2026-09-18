package com.narrativex.backend.feature.assets.infrastructure.storage;

import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Local filesystem-backed implementation of ObjectStoragePort. Routes private object storage
 * operations to ProjectLocalMediaAccess.
 */
@Component
public class LocalObjectStorageAdapter implements ObjectStoragePort {
  private final ProjectLocalMediaAccess mediaAccess;
  private final URI baseUrl;

  public LocalObjectStorageAdapter(
      ProjectLocalMediaAccess mediaAccess,
      @Value("${narrativex.public-base-url:${narrativex.security.public-base-url:}}")
          String publicBaseUrl) {
    this.mediaAccess = mediaAccess;
    String normalizedBase = publicBaseUrl == null ? "" : publicBaseUrl.trim();
    if (normalizedBase.isBlank()) normalizedBase = "http://localhost:8080";
    this.baseUrl = URI.create(normalizedBase.replaceAll("/$", ""));
  }

  @Override
  public PresignedUpload createUpload(CreateUpload command) {
    URI uploadUrl =
        mediaAccess.createUploadUrl(
            command.storageKey(),
            command.contentType(),
            command.contentLength(),
            command.expiresAt(),
            baseUrl);
    return new PresignedUpload(
        command.storageKey(),
        uploadUrl,
        command.expiresAt(),
        Map.of("Content-Type", command.contentType()));
  }

  @Override
  public PresignedDownload createDownload(String storageKey, Instant expiresAt) {
    URI downloadUrl = mediaAccess.createDownloadUrl(storageKey, expiresAt, baseUrl);
    return new PresignedDownload(storageKey, downloadUrl, expiresAt);
  }

  @Override
  public StoredObject head(String storageKey) {
    try {
      var inspected = mediaAccess.inspect(storageKey);
      return new StoredObject(
          inspected.storageKey(),
          inspected.sizeBytes(),
          inspected.contentType(),
          inspected.sha256());
    } catch (IllegalArgumentException | IllegalStateException e) {
      throw new ObjectStoragePort.ObjectNotFoundException(storageKey);
    }
  }

  @Override
  public void delete(String storageKey) {
    mediaAccess.deleteIfExists(storageKey);
  }
}
