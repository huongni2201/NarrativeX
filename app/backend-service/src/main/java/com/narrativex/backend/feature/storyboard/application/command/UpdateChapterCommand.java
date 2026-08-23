package com.narrativex.backend.feature.storyboard.application.command;

import java.util.UUID;

public record UpdateChapterCommand(
    UUID projectId, UUID chapterId, long expectedRowVersion, String title, String sourceText) {}
