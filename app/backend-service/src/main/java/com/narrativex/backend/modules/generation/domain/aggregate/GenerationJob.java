package com.narrativex.backend.modules.generation.domain.aggregate;

import com.narrativex.backend.shared.domain.AggregateRoot;
import java.util.Objects;
import java.util.UUID;

/** Durable generation job aggregate; project ownership is represented by an ID, not a cross-module entity link. */
public final class GenerationJob extends AggregateRoot {

    private final String jobId;
    private final Long projectId;
    private final JobType type;
    private JobStatus status;
    private final ResourceClass resourceClass;
    private final int progress;
    private final String currentStep;
    private final String errorCode;
    private final String requestedByUserId;
    private final String billedToUserId;

    private GenerationJob(Long id, long rowVersion, String jobId, Long projectId, JobType type,
                          JobStatus status, ResourceClass resourceClass, int progress, String currentStep,
                          String errorCode, String requestedByUserId, String billedToUserId) {
        super(id, rowVersion);
        this.jobId = Objects.requireNonNull(jobId, "jobId");
        this.projectId = Objects.requireNonNull(projectId, "projectId");
        this.type = Objects.requireNonNull(type, "type");
        this.status = Objects.requireNonNull(status, "status");
        this.resourceClass = Objects.requireNonNull(resourceClass, "resourceClass");
        this.progress = progress;
        this.currentStep = currentStep;
        this.errorCode = errorCode;
        this.requestedByUserId = Objects.requireNonNull(requestedByUserId, "requestedByUserId");
        this.billedToUserId = Objects.requireNonNull(billedToUserId, "billedToUserId");
    }

    public static GenerationJob create(Long projectId, JobType type, ResourceClass resourceClass, String userId) {
        return new GenerationJob(null, 0L, UUID.randomUUID().toString(), projectId, type, JobStatus.QUEUED,
            resourceClass, 0, "QUEUED", null, userId, userId);
    }

    public static GenerationJob rehydrate(Long id, long rowVersion, String jobId, Long projectId, JobType type,
                                           JobStatus status, ResourceClass resourceClass, int progress,
                                           String currentStep, String errorCode, String requestedByUserId,
                                           String billedToUserId) {
        return new GenerationJob(id, rowVersion, jobId, projectId, type, status, resourceClass, progress,
            currentStep, errorCode, requestedByUserId, billedToUserId);
    }

    public String getJobId() { return jobId; }
    public Long getProjectId() { return projectId; }
    public JobType getType() { return type; }
    public JobStatus getStatus() { return status; }
    public ResourceClass getResourceClass() { return resourceClass; }
    public int getProgress() { return progress; }
    public String getCurrentStep() { return currentStep; }
    public String getErrorCode() { return errorCode; }
    public String getRequestedByUserId() { return requestedByUserId; }
    public String getBilledToUserId() { return billedToUserId; }
}
