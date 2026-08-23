package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import java.time.Instant;

public record ChapterContentVariantResponse(
    Long id,
    Long chapterId,
    Long sourceVariantId,
    String variantType,
    String languageCode,
    String content,
    String contentHash,
    String sourceContentHash,
    String translationProvider,
    String translationModel,
    String translationStatus,
    Instant createdAt) {
  public static ChapterContentVariantResponse from(ChapterContentVariant value) {
    return new ChapterContentVariantResponse(
        value.id(),
        value.chapterId(),
        value.sourceVariantId(),
        value.type().name(),
        value.languageCode(),
        value.content(),
        value.contentHash(),
        value.sourceContentHash(),
        value.translationProvider(),
        value.translationModel(),
        value.status().name(),
        value.createdAt());
  }
}
