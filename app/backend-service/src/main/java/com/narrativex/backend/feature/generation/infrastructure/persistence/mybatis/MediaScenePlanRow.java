package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MediaScenePlanRow {
  private UUID mediaPlanId;
  private int sceneIndex;
  private UUID sceneId;
  private int sceneOrderIndex;
  private String narration;
  private Integer durationSeconds;
}
