package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectAssetRow {
  private UUID id;
  private String name;
  private String assetType;
  private String storageKey;
  private String url;
  private String mimeType;
  private String status;
  private String metadataJson;
  private Instant updatedAt;
}
