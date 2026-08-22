package com.narrativex.backend.feature.generation.application.command;

public record ConfirmChapterTranslationCommand(
    Long projectId,
    Long chapterId,
    Long sourceVariantId,
    String sourceContentHash,
    String targetLanguage,
    String requestKey) {}
