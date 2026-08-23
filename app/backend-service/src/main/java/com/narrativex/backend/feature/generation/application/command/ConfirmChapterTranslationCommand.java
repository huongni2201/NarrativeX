package com.narrativex.backend.feature.generation.application.command;

import java.util.UUID;

public record ConfirmChapterTranslationCommand(
    UUID projectId,
    UUID chapterId,
    UUID sourceVariantId,
    String sourceContentHash,
    String targetLanguage) {}
