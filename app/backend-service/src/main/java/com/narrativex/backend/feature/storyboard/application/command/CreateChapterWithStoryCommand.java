package com.narrativex.backend.feature.storyboard.application.command;

import java.util.UUID;

public record CreateChapterWithStoryCommand(
    UUID projectId,
    UUID storyVersionId,
    Integer orderIndex,
    String title,
    String sourceText,
    String idempotencyKey) {}
