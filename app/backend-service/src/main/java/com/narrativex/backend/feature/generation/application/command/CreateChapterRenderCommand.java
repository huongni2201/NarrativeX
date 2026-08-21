package com.narrativex.backend.feature.generation.application.command;

public record CreateChapterRenderCommand(
    Long projectId, Long chapterId, String resolution, String format) {}
