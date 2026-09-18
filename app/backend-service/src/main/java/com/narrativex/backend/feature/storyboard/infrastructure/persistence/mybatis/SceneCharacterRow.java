package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SceneCharacterRow {
  private UUID sceneId;
  private int orderIndex;
  private UUID projectCharacterId;
}
