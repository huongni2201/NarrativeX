package com.narrativex.backend.modules.generation.api;

import com.narrativex.backend.modules.generation.domain.model.GenerationJob;

public record JobResponse(
    String jobId,
    String type,
    String status,
    int progress,
    String currentStep,
    String entityType,
    Long entityId,
    String errorCode
) {
    public static JobResponse from(GenerationJob job) {
        return new JobResponse(job.getJobId(), job.getType().name(), job.getStatus().name(), job.getProgress(),
            job.getCurrentStep(), "PROJECT", job.getProjectId(), job.getErrorCode());
    }
}
