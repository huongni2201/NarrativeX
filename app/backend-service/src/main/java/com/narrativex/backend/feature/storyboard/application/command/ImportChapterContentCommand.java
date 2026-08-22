package com.narrativex.backend.feature.storyboard.application.command;

public record ImportChapterContentCommand(Long projectId, Long chapterId, String content, String title) {}
