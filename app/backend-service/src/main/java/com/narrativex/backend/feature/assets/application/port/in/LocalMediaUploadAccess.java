package com.narrativex.backend.feature.assets.application.port.in;

import java.io.InputStream;

/** Application input port for capability-authorized uploads into project-local media. */
public interface LocalMediaUploadAccess extends MediaStorageAccess {
  UploadedMedia upload(String token, InputStream body, String contentType);

  record UploadedMedia(String storageKey, long sizeBytes, String contentType, String sha256) {}
}
