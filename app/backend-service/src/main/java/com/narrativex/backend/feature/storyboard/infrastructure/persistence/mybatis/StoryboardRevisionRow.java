package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StoryboardRevisionRow {
  private Long id;
  private String sourceHash;
  private boolean hasApprovedOutput;
}
