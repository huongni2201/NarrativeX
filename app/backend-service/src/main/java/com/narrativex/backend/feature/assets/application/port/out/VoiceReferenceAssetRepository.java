package com.narrativex.backend.feature.assets.application.port.out;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Account-scoped R2 voice-reference metadata. Voice references are never project media. */
public interface VoiceReferenceAssetRepository {
  VoiceReferenceAsset createOrReuse(String accountId, CreateVoiceReference command);

  Optional<VoiceReferenceAsset> findOwned(String accountId, UUID id);

  List<VoiceReferenceAsset> listOwned(String accountId);

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
