package com.narrativex.backend.feature.assets.application.port.out;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Voice-reference metadata. */
public interface VoiceReferenceAssetRepository {
  VoiceReferenceAsset createOrReuse(CreateVoiceReference command);

  Optional<VoiceReferenceAsset> findById(UUID id);

  List<VoiceReferenceAsset> list();

  boolean isReferencedByReadyAsset(String storageKey);

  record CreateVoiceReference(
      UUID proposedId,
      String storageKey,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256) {}

  record VoiceReferenceAsset(
      UUID id,
      String storageKey,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      String status) {}
}
