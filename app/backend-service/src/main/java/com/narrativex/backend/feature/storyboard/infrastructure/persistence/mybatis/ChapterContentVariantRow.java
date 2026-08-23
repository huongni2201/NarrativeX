package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.storyboard.domain.enums.ContentVariantType;
import com.narrativex.backend.feature.storyboard.domain.enums.TranslationStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChapterContentVariantRow {
  private UUID id;
  private UUID chapterId;
  private UUID sourceVariantId;
  private ContentVariantType type;
  private String languageCode;
  private String content;
  private String contentHash;
  private String sourceContentHash;
  private TranslationStatus translationStatus;
  private String translationProvider;
  private String translationModel;
  private Instant createdAt;
  private Instant updatedAt;
}
