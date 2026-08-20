package com.narrativex.backend.feature.generation.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "generation_jobs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerationJobJpaEntity extends JpaAuditedEntity {
  @Column(name = "job_id", nullable = false, unique = true, length = 36)
  private String jobId;

  @Column(name = "project_id", nullable = false)
  private Long projectId;

  @Enumerated(EnumType.STRING)
  @Column(name = "job_type", nullable = false, length = 32)
  private JobType type;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 32)
  private JobStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "resource_class", nullable = false, length = 32)
  private ResourceClass resourceClass;

  @Column(name = "progress", nullable = false)
  private int progress;

  @Column(name = "current_step", length = 80)
  private String currentStep;

  @Column(name = "error_code", length = 80)
  private String errorCode;

  @Column(name = "requested_by_user_id", nullable = false, length = 128)
  private String requestedByUserId;

  @Column(name = "billed_to_user_id", nullable = false, length = 128)
  private String billedToUserId;

  @Column(name = "story_version_id")
  private Long storyVersionId;

  @Column(name = "chapter_id")
  private Long chapterId;

  @Column(name = "storyboard_revision_id")
  private Long storyboardRevisionId;

  @Column(name = "chapter_row_version")
  private Long chapterRowVersion;

  @Column(name = "source_hash", length = 64)
  private String sourceHash;

  @Column(name = "source_text", columnDefinition = "TEXT")
  private String sourceText;

  @Column(name = "source_language", length = 16)
  private String sourceLanguage;

  @Column(name = "idempotency_key", length = 200)
  private String idempotencyKey;

  @Column(name = "media_plan_id")
  private UUID mediaPlanId;

  @Column(name = "media_plan_revision")
  private Integer mediaPlanRevision;

  @Enumerated(EnumType.STRING)
  @Column(name = "production_mode", length = 32)
  private ProductionMode productionMode;

  public void apply(GenerationJob job) {
    jobId = job.getJobId();
    projectId = job.getProjectId();
    type = job.getType();
    status = job.getStatus();
    resourceClass = job.getResourceClass();
    progress = job.getProgress();
    currentStep = job.getCurrentStep();
    errorCode = job.getErrorCode();
    requestedByUserId = job.getRequestedByUserId();
    billedToUserId = job.getBilledToUserId();
    storyVersionId = job.getStoryVersionId();
    chapterId = job.getChapterId();
    storyboardRevisionId = job.getStoryboardRevisionId();
    chapterRowVersion = job.getChapterRowVersion();
    sourceHash = job.getSourceHash();
    sourceText = job.getSourceText();
    sourceLanguage = job.getSourceLanguage();
    idempotencyKey = job.getIdempotencyKey();
    mediaPlanId = job.getMediaPlanId();
    mediaPlanRevision = job.getMediaPlanRevision();
    productionMode = job.getProductionMode();
  }
}
