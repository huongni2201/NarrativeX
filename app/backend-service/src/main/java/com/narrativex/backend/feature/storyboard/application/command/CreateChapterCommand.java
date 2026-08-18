package com.narrativex.backend.feature.storyboard.application.command;

public record CreateChapterCommand(
    Long projectId,
    Long storyVersionId,
    int orderIndex,
    String title,
    String sourceText) {}
