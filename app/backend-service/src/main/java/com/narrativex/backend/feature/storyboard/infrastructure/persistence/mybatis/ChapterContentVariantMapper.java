package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterContentVariantMapper extends NarrativeXMyBatisMapper {
  Long insert(ChapterContentVariantRow row);

  ChapterContentVariantRow findById(@Param("id") Long id);

  ChapterContentVariantRow findByIdOwned(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("variantId") Long variantId,
      @Param("userId") String userId);

  ChapterContentVariantRow findCurrentOriginalOwned(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("userId") String userId);

  ChapterContentVariantRow findByIdentity(
      @Param("chapterId") UUID chapterId,
      @Param("sourceVariantId") Long sourceVariantId,
      @Param("languageCode") String languageCode,
      @Param("sourceContentHash") String sourceContentHash,
      @Param("contentHash") String contentHash);

  ChapterContentVariantRow findLatestOriginal(@Param("chapterId") UUID chapterId);

  ChapterContentVariantRow findCompletedTranslation(
      @Param("chapterId") UUID chapterId,
      @Param("sourceVariantId") Long sourceVariantId,
      @Param("languageCode") String languageCode,
      @Param("sourceContentHash") String sourceContentHash);

  ChapterContentVariantRow findCompletedTranslationByIdentity(
      @Param("chapterId") UUID chapterId,
      @Param("sourceVariantId") Long sourceVariantId,
      @Param("languageCode") String languageCode,
      @Param("sourceContentHash") String sourceContentHash,
      @Param("contentHash") String contentHash);

  List<ChapterContentVariantRow> findAllOwned(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  int markTranslationsStale(
      @Param("chapterId") UUID chapterId,
      @Param("currentSourceVariantId") Long currentSourceVariantId);

  int updateStatus(@Param("variantId") Long variantId, @Param("status") String status);
}
