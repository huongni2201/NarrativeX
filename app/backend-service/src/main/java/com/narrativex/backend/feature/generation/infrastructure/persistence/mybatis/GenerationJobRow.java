package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GenerationJobRow {
  private Long id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private String jobId;
  private UUID projectId;
  private JobType type;
  private JobStatus status;
  private ResourceClass resourceClass;
  private int progress;
  private String currentStep;
  private String errorCode;
  private String requestedByUserId;
  private String billedToUserId;
  private UUID storyVersionId;
  private UUID chapterId;
  private Long chapterRowVersion;
  private String sourceHash;
  private String sourceText;
  private String sourceLanguage;
  private String idempotencyKey;
  private UUID storyboardRevisionId;
  private UUID mediaPlanId;
  private Integer mediaPlanRevision;
  private ProductionMode productionMode;
  private Long contentVariantId;
  private Long sourceVariantId;
  private String targetLanguage;
}
