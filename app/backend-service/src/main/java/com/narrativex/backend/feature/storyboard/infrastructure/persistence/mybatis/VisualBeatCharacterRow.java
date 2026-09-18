package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VisualBeatCharacterRow {
  private UUID visualBeatId;
  private UUID projectCharacterId;
  private String role;
}
