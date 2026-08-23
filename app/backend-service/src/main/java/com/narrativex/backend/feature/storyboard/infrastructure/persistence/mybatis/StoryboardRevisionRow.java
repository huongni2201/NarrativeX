package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StoryboardRevisionRow {
  private UUID id;
  private String sourceHash;
  private boolean hasApprovedOutput;
}
