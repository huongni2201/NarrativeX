package com.narrativex.backend.modules.generation.domain;

import com.narrativex.backend.modules.project.domain.Project;
import com.narrativex.backend.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "generation_jobs")
public class GenerationJob extends AuditedEntity {

    @Column(name = "job_id", nullable = false, unique = true, length = 36)
    private String jobId = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_generation_jobs_project"))
    private Project project;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", nullable = false, length = 32)
    private JobType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private JobStatus status = JobStatus.QUEUED;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_class", nullable = false, length = 32)
    private ResourceClass resourceClass;

    @Column(name = "progress", nullable = false)
    private int progress;

    @Column(name = "current_step", length = 80)
    private String currentStep = "QUEUED";

    @Column(name = "error_code", length = 80)
    private String errorCode;

    @Column(name = "requested_by_user_id", nullable = false, length = 128)
    private String requestedByUserId;

    @Column(name = "billed_to_user_id", nullable = false, length = 128)
    private String billedToUserId;

    protected GenerationJob() {
    }

    public GenerationJob(Project project, JobType type, ResourceClass resourceClass, String userId) {
        this.project = project;
        this.type = type;
        this.resourceClass = resourceClass;
        this.requestedByUserId = userId;
        this.billedToUserId = userId;
    }

    public String getJobId() { return jobId; }
    public Project getProject() { return project; }
    public JobType getType() { return type; }
    public JobStatus getStatus() { return status; }
    public ResourceClass getResourceClass() { return resourceClass; }
    public int getProgress() { return progress; }
    public String getCurrentStep() { return currentStep; }
    public String getErrorCode() { return errorCode; }
}
