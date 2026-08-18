package com.narrativex.backend.feature.generation.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import jakarta.persistence.*;

@Entity
@Table(name = "generation_jobs")
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

  protected GenerationJobJpaEntity() {}

  public GenerationJobJpaEntity(GenerationJob job) {
    apply(job);
  }

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
  }

  public String getJobId() {
    return jobId;
  }

  public Long getProjectId() {
    return projectId;
  }

  public JobType getType() {
    return type;
  }

  public JobStatus getStatus() {
    return status;
  }

  public ResourceClass getResourceClass() {
    return resourceClass;
  }

  public int getProgress() {
    return progress;
  }

  public String getCurrentStep() {
    return currentStep;
  }

  public String getErrorCode() {
    return errorCode;
  }

  public String getRequestedByUserId() {
    return requestedByUserId;
  }

  public String getBilledToUserId() {
    return billedToUserId;
  }
}
