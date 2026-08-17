package com.narrativex.backend.modules.generation.application.command;

public record EnqueueStoryAnalysisCommand(Long projectId, String ownerId) {
}
