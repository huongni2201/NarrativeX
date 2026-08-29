package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.VoiceReferenceAsset;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VoiceReferenceAssetRow {
  private UUID id;
  private String storageKey;
  private String originalFilename;
  private String contentType;
  private long sizeBytes;
  private String sha256;
  private String status;

  public VoiceReferenceAsset toDomain() {
    return new VoiceReferenceAsset(
        id, storageKey, originalFilename, contentType, sizeBytes, sha256, status);
  }
}
