package com.narrativex.backend.modules.generation.domain;

public enum JobStatus {
    QUEUED,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELED,
    UNKNOWN,
    STALLED,
    PAUSED_COST_LIMIT
}
