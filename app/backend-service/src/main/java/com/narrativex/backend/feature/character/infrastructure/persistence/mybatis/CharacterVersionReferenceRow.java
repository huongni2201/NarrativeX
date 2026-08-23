package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterVersionReferenceRow {
  private UUID characterVersionId;
  private UUID mediaAssetId;
  private String referenceRole;
  private int priority;
}
