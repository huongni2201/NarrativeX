package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RejectedUploadRow {
  private UUID id;
  private String storageKey;
}
