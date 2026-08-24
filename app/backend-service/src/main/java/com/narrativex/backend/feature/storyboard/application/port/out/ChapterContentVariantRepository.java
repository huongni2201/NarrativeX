package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterContentVariantAccess;
import com.narrativex.backend.feature.storyboard.domain.enums.TranslationStatus;
import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChapterContentVariantRepository extends ChapterContentVariantAccess {
  ChapterContentVariant saveOriginal(
      UUID chapterId, String languageCode, String content, String contentHash);

  ChapterContentVariant saveTranslation(
      UUID chapterId,
      UUID sourceVariantId,
      String languageCode,
      String content,
      String contentHash,
      String sourceContentHash,
      String provider,
      String model);

  Optional<ChapterContentVariant> findByIdOwned(
      UUID projectId, UUID chapterId, UUID variantId, String userId);

  Optional<ChapterContentVariant> findByIdentity(
      UUID chapterId,
      UUID sourceVariantId,
      String languageCode,
      String sourceContentHash,
      String contentHash);

  Optional<ChapterContentVariant> findLatestOriginal(UUID chapterId);

  Optional<ChapterContentVariant> findCompletedTranslation(
      UUID chapterId, UUID sourceVariantId, String languageCode, String sourceContentHash);

  Optional<ChapterContentVariant> findCompletedTranslation(
      UUID chapterId,
      UUID sourceVariantId,
      String languageCode,
      String sourceContentHash,
      String contentHash);

  List<ChapterContentVariant> findAllOwned(UUID projectId, UUID chapterId, String userId);

  void markTranslationsStale(UUID chapterId, UUID currentSourceVariantId);

  void updateStatus(UUID variantId, TranslationStatus status);
}
