package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterWorkspaceMediaIdentityRow {
  private String latestJobId;
  private UUID mediaPlanId;
  private Integer mediaPlanRevision;
}
