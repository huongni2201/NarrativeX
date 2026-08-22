package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterContentVariantAccess;
import com.narrativex.backend.feature.storyboard.domain.enums.TranslationStatus;
import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import java.util.List;
import java.util.Optional;

public interface ChapterContentVariantRepository extends ChapterContentVariantAccess {
  ChapterContentVariant saveOriginal(
      Long chapterId, String languageCode, String content, String contentHash);

  ChapterContentVariant saveTranslation(
      Long chapterId,
      Long sourceVariantId,
      String languageCode,
      String content,
      String contentHash,
      String sourceContentHash,
      String provider,
      String model);

  Optional<ChapterContentVariant> findByIdOwned(
      Long projectId, Long chapterId, Long variantId, String userId);

  Optional<ChapterContentVariant> findByIdentity(
      Long chapterId, Long sourceVariantId, String languageCode, String sourceContentHash,
      String contentHash);

  Optional<ChapterContentVariant> findLatestOriginal(Long chapterId);

  Optional<ChapterContentVariant> findCompletedTranslation(
      Long chapterId, Long sourceVariantId, String languageCode, String sourceContentHash);

  Optional<ChapterContentVariant> findCompletedTranslation(
      Long chapterId, Long sourceVariantId, String languageCode, String sourceContentHash,
      String contentHash);

  List<ChapterContentVariant> findAllOwned(Long projectId, Long chapterId);

  void markTranslationsStale(Long chapterId, Long currentSourceVariantId);

  void updateStatus(Long variantId, TranslationStatus status);
}
