package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.List;
import java.util.Optional;

public interface ChapterRepository {
  Chapter save(Chapter chapter);

  Chapter saveAndFlush(Chapter chapter);

  Optional<Chapter> findById(Long chapterId);

  List<Chapter> findAllByStoryVersionId(Long storyVersionId);

  boolean existsByStoryVersionIdAndOrderIndex(Long storyVersionId, int orderIndex);
}
