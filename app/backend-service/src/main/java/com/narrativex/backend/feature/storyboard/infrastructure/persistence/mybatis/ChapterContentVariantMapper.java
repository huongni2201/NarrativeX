package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface ChapterContentVariantMapper extends NarrativeXMyBatisMapper {
  Long insert(ChapterContentVariantRow row);

  ChapterContentVariantRow findById(@Param("id") Long id);

  ChapterContentVariantRow findByIdOwned(
      @Param("projectId") Long projectId,
      @Param("chapterId") Long chapterId,
      @Param("variantId") Long variantId,
      @Param("userId") String userId);

  ChapterContentVariantRow findCurrentOriginalOwned(
      @Param("projectId") Long projectId,
      @Param("chapterId") Long chapterId,
      @Param("userId") String userId);

  ChapterContentVariantRow findByIdentity(
      @Param("chapterId") Long chapterId,
      @Param("sourceVariantId") Long sourceVariantId,
      @Param("languageCode") String languageCode,
      @Param("sourceContentHash") String sourceContentHash,
      @Param("contentHash") String contentHash);

  ChapterContentVariantRow findLatestOriginal(@Param("chapterId") Long chapterId);

  ChapterContentVariantRow findCompletedTranslation(
      @Param("chapterId") Long chapterId,
      @Param("sourceVariantId") Long sourceVariantId,
      @Param("languageCode") String languageCode,
      @Param("sourceContentHash") String sourceContentHash);

  ChapterContentVariantRow findCompletedTranslationByIdentity(
      @Param("chapterId") Long chapterId,
      @Param("sourceVariantId") Long sourceVariantId,
      @Param("languageCode") String languageCode,
      @Param("sourceContentHash") String sourceContentHash,
      @Param("contentHash") String contentHash);

  List<ChapterContentVariantRow> findAllOwned(
      @Param("projectId") Long projectId, @Param("chapterId") Long chapterId);

  int markTranslationsStale(
      @Param("chapterId") Long chapterId, @Param("currentSourceVariantId") Long currentSourceVariantId);

  int updateStatus(@Param("variantId") Long variantId, @Param("status") String status);
}
