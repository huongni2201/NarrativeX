package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import java.util.Optional;

public interface ChapterContentVariantAccess {
  Optional<ChapterContentVariant> findByIdOwned(
      Long projectId, Long chapterId, Long variantId, String userId);

  Optional<ChapterContentVariant> findCurrentOriginalOwned(
      Long projectId, Long chapterId, String userId);
}
