package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAccess;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChapterRepository extends ChapterAccess {
  Chapter save(Chapter chapter);

  Chapter saveAndFlush(Chapter chapter);

  void deleteById(UUID chapterId);

  Optional<Chapter> findById(UUID chapterId);

  List<Chapter> findAllByStoryVersionId(UUID storyVersionId);

  int findMaxOrderIndexByStoryVersionId(UUID storyVersionId);

  CursorPage<Chapter> findPageByStoryVersionId(UUID storyVersionId, String cursor, int limit);

  boolean existsByStoryVersionIdAndOrderIndex(UUID storyVersionId, int orderIndex);
}
