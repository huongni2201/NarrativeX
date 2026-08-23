package com.narrativex.backend.feature.assets.application.port.in;

import java.net.URI;
import java.time.Instant;

public interface MediaStorageAccess {
  URI createDownloadUrl(String storageKey, Instant expiresAt);
}
