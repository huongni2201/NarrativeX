package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import java.util.Optional;
import java.util.UUID;

public interface ChapterContentVariantAccess {
  Optional<ChapterContentVariant> findByIdOwned(
      UUID projectId, UUID chapterId, Long variantId, String userId);

  Optional<ChapterContentVariant> findCurrentOriginalOwned(
      UUID projectId, UUID chapterId, String userId);
}
