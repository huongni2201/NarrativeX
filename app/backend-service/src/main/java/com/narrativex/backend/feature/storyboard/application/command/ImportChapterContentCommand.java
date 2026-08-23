package com.narrativex.backend.feature.storyboard.application.command;

import java.util.UUID;

public record ImportChapterContentCommand(
    UUID projectId, UUID chapterId, String content, String title) {}
