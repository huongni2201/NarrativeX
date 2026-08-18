package com.narrativex.backend.feature.storyboard.application.command;

public record UpdateChapterCommand(
    Long projectId,
    Long chapterId,
    long expectedRowVersion,
    String title,
    String sourceText) {}
