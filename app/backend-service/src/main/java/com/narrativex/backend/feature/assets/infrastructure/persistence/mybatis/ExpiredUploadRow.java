package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ExpiredUploadRow {
  private UUID id;
  private String accountId;
  private String storageKey;
}
