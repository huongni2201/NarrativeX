package com.narrativex.backend.feature.storyboard.domain.value;

import com.narrativex.backend.feature.storyboard.domain.enums.ContentVariantType;
import com.narrativex.backend.feature.storyboard.domain.enums.TranslationStatus;
import java.time.Instant;

public record ChapterContentVariant(
    Long id,
    Long chapterId,
    Long sourceVariantId,
    ContentVariantType type,
    String languageCode,
    String content,
    String contentHash,
    String sourceContentHash,
    String translationProvider,
    String translationModel,
    TranslationStatus status,
    Instant createdAt) {}
