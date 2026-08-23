package com.narrativex.backend.feature.project.application.command;

public record CreateChapterWithStoryCommand(
    Long projectId,
    Long storyVersionId,
    Integer orderIndex,
    String title,
    String sourceText,
    String idempotencyKey) {}
