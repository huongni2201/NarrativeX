package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.storyboard.application.port.out.ChapterContentVariantRepository;
import com.narrativex.backend.feature.storyboard.domain.enums.ContentVariantType;
import com.narrativex.backend.feature.storyboard.domain.enums.TranslationStatus;
import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterContentVariantMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterContentVariantRow;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterContentVariantRepository implements ChapterContentVariantRepository {
  private final ChapterContentVariantMapper mapper;

  @Override
  public ChapterContentVariant saveOriginal(
      Long chapterId, String languageCode, String content, String contentHash) {
    return save(
        new ChapterContentVariantRow(
            null,
            chapterId,
            null,
            ContentVariantType.ORIGINAL,
            languageCode,
            content,
            contentHash,
            contentHash,
            TranslationStatus.NOT_REQUIRED,
            null,
            null,
            Instant.now(),
            Instant.now()));
  }

  @Override
  public ChapterContentVariant saveTranslation(
      Long chapterId,
      Long sourceVariantId,
      String languageCode,
      String content,
      String contentHash,
      String sourceContentHash,
      String provider,
      String model) {
    return save(
        new ChapterContentVariantRow(
            null,
            chapterId,
            sourceVariantId,
            ContentVariantType.TRANSLATION,
            languageCode,
            content,
            contentHash,
            sourceContentHash,
            TranslationStatus.COMPLETED,
            provider,
            model,
            Instant.now(),
            Instant.now()));
  }

  private ChapterContentVariant save(ChapterContentVariantRow row) {
    Long id = mapper.insert(row);
    if (id == null) {
      ChapterContentVariantRow existing = mapper.findByIdentity(
          row.getChapterId(), row.getSourceVariantId(), row.getLanguageCode(),
          row.getSourceContentHash(), row.getContentHash());
      if (existing == null) throw new IllegalStateException("Content variant was not persisted");
      return toDomain(existing);
    }
    ChapterContentVariantRow saved = mapper.findById(id);
    if (saved == null) throw new IllegalStateException("Content variant disappeared");
    return toDomain(saved);
  }

  @Override
  public Optional<ChapterContentVariant> findByIdOwned(Long projectId, Long chapterId, Long variantId, String userId) {
    return Optional.ofNullable(mapper.findByIdOwned(projectId, chapterId, variantId, userId)).map(MyBatisChapterContentVariantRepository::toDomain);
  }

  @Override
  public Optional<ChapterContentVariant> findCurrentOriginalOwned(
      Long projectId, Long chapterId, String userId) {
    return Optional.ofNullable(mapper.findCurrentOriginalOwned(projectId, chapterId, userId))
        .map(MyBatisChapterContentVariantRepository::toDomain);
  }

  @Override
  public Optional<ChapterContentVariant> findByIdentity(
      Long chapterId, Long sourceVariantId, String languageCode, String sourceContentHash,
      String contentHash) {
    return Optional.ofNullable(mapper.findByIdentity(
            chapterId, sourceVariantId, languageCode, sourceContentHash, contentHash))
        .map(MyBatisChapterContentVariantRepository::toDomain);
  }

  @Override
  public Optional<ChapterContentVariant> findLatestOriginal(Long chapterId) {
    return Optional.ofNullable(mapper.findLatestOriginal(chapterId)).map(MyBatisChapterContentVariantRepository::toDomain);
  }

  @Override
  public Optional<ChapterContentVariant> findCompletedTranslation(
      Long chapterId, Long sourceVariantId, String languageCode, String sourceContentHash) {
    return Optional.ofNullable(mapper.findCompletedTranslation(
            chapterId, sourceVariantId, languageCode, sourceContentHash))
        .map(MyBatisChapterContentVariantRepository::toDomain);
  }

  @Override
  public Optional<ChapterContentVariant> findCompletedTranslation(
      Long chapterId, Long sourceVariantId, String languageCode, String sourceContentHash,
      String contentHash) {
    return Optional.ofNullable(mapper.findCompletedTranslationByIdentity(
            chapterId, sourceVariantId, languageCode, sourceContentHash, contentHash))
        .map(MyBatisChapterContentVariantRepository::toDomain);
  }

  @Override
  public List<ChapterContentVariant> findAllOwned(Long projectId, Long chapterId) {
    return mapper.findAllOwned(projectId, chapterId).stream().map(MyBatisChapterContentVariantRepository::toDomain).toList();
  }

  @Override
  public void markTranslationsStale(Long chapterId, Long currentSourceVariantId) {
    mapper.markTranslationsStale(chapterId, currentSourceVariantId);
  }

  @Override
  public void updateStatus(Long variantId, TranslationStatus status) {
    mapper.updateStatus(variantId, status.name());
  }

  static ChapterContentVariant toDomain(ChapterContentVariantRow row) {
    return new ChapterContentVariant(
        row.getId(), row.getChapterId(), row.getSourceVariantId(), row.getType(), row.getLanguageCode(),
        row.getContent(), row.getContentHash(), row.getSourceContentHash(), row.getTranslationProvider(), row.getTranslationModel(),
        row.getTranslationStatus(), row.getCreatedAt());
  }
}
