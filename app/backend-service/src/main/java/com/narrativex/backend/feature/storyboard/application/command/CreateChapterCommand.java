package com.narrativex.backend.feature.storyboard.application.command;

import java.util.UUID;

public record CreateChapterCommand(
    UUID projectId, UUID storyVersionId, int orderIndex, String title, String sourceText) {}
