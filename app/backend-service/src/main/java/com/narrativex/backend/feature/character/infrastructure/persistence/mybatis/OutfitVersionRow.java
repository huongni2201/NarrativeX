package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class OutfitVersionRow {
  private Long id; private long rowVersion; private Instant createdAt; private Instant updatedAt;
  private Long characterId; private int versionNumber; private String name; private String description; private String prompt; private String status;
}
