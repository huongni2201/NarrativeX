package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAccess;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.List;
import java.util.Optional;

public interface ChapterRepository extends ChapterAccess {
  Chapter save(Chapter chapter);

  Chapter saveAndFlush(Chapter chapter);

  Optional<Chapter> findById(Long chapterId);

  List<Chapter> findAllByStoryVersionId(Long storyVersionId);

  CursorPage<Chapter> findPageByStoryVersionId(Long storyVersionId, String cursor, int limit);

  boolean existsByStoryVersionIdAndOrderIndex(Long storyVersionId, int orderIndex);
}
