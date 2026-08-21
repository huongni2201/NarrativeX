package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MediaBeatPlanRow {
  private UUID mediaPlanId;
  private int sceneIndex;
  private int beatIndex;
  private Long visualBeatId;
  private int visualBeatOrderIndex;
  private String visualIntent;
  private String semanticMotionMode;
  private MotionStrategy motionStrategy;
}
