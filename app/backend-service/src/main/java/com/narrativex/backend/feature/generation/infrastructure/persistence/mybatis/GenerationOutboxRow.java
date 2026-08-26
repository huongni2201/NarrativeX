package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GenerationOutboxRow {
  private String aggregateId;
  private String eventKey;
  private JobType jobType;
  private UUID projectId;
  private UUID storyVersionId;
  private UUID chapterId;
  private Long chapterRowVersion;
  private String sourceHash;
  private UUID mediaPlanId;
  private Integer mediaPlanRevision;
  private ProductionMode productionMode;
}
